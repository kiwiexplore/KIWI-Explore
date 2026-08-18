import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { NormalBlending, ShaderMaterial, Vector3 } from "three";
import { brainRegions } from "../../state/brainRegions";
import { connectionPositions } from "./connectionGeometry";
import { BRAIN_CENTER } from "./keptNodes";
import { getHazeTexture, HAZE_TEXTURE_VARIANTS } from "./dotTexture";

// Deterministic hash (not Math.random — this runs inside a useMemo
// initializer during render, so it has to stay pure/reproducible).
function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

// Puffs per connection. Smoke needs plenty of overlapping ones to read
// as a continuous medium rather than as separate blobs.
const SAMPLES_PER_CONNECTION = 3;
// Each puff is nudged off the line it was sampled from, so the smoke
// fills the space around the wiring instead of tracing it.
const SPREAD = 0.1;
// World-space size range. The wide spread is doing real work: fine wisps
// inside broad drifts is what separates smoke from a field of identical
// sprites.
const SIZE_MIN = 0.1;
const SIZE_MAX = 0.9;
// Per-puff opacity, before the shader's own falloff. Low and varied —
// the density of the smoke comes from many faint layers overlapping,
// never from any single puff being visible on its own.
const ALPHA_MIN = 0.045;
const ALPHA_MAX = 0.12;

// Neutral, slightly cool grey: smoke isn't a colour, it's a medium
// catching what little light is around. The regions are told apart by
// their neurons and connection lines — the smoke stays out of that job
// on purpose.
const SMOKE_COLOR = new Vector3(0.62, 0.66, 0.74);
// How much darker a puff deep inside the brain is than one out at the
// shell. This is what gives the mass shape; without it a cloud with no
// shading in it reads as flat fog.
const CORE_SHADE = 0.42;
const SHELL_RADIUS = 0.95;

// Hovering or opening a region lifts that area's smoke a little along
// with its neurons, so the area still lights up as one thing.
const REGION_HIGHLIGHT = 0.55;
// ...and everything else thins out, matching what the neurons and the
// web do (see NeuronLayer / ConnectionLayer). Without this the smoke
// stayed flat across the whole brain and blunted the separation the
// other two layers were making.
const REGION_UNLIT_DIM = 0.45;
// Resting density, with nothing hovered or open — the same idea as the
// neurons' and the web's own idle levels, so the three settle back
// together rather than one staying hot.
const IDLE_DENSITY = 0.72;
const REGION_FADE_SPEED = 4.5;

const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aAlpha;
    attribute float aPhase;
    attribute float aShade;
    attribute float aRegion;

    uniform float uTime;
    uniform float uScale;
    uniform float uLitRegion;
    uniform float uHighlight;

    varying float vAlpha;
    varying float vShade;

    void main() {
        // Turbulence, done on the GPU: sine pairs at different rates per
        // axis standing in for curl noise. Cheap, swirling rather than
        // blowing outward, and it costs nothing per frame on the CPU —
        // which is what makes tens of thousands of puffs affordable.
        float t = uTime * 0.05 + aPhase;
        vec3 drift = vec3(
            sin(t + position.y * 3.1) * 0.045 + sin(t * 1.7 + position.z * 5.3) * 0.018,
            cos(t * 0.8 + position.z * 2.7) * 0.040 + sin(t * 1.3 + position.x * 4.9) * 0.016,
            sin(t * 0.9 + position.x * 2.9) * 0.045 + cos(t * 1.5 + position.y * 5.1) * 0.017
        );

        vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);
        float dist = -mvPosition.z;

        // A puff right in front of the lens would otherwise blow up to
        // fill the screen — which happens constantly once the camera is
        // inside the brain. Fade those out instead, the way a real lens
        // simply can't resolve smoke sitting on the front element.
        float nearFade = smoothstep(0.08, 0.75, dist);

        float lit = step(0.0, aRegion) * (1.0 - step(0.5, abs(aRegion - uLitRegion)));
        float region = mix(
            ${IDLE_DENSITY.toFixed(2)},
            mix(1.0 - ${REGION_UNLIT_DIM.toFixed(2)}, 1.0 + ${REGION_HIGHLIGHT.toFixed(2)}, lit),
            uHighlight
        );
        vAlpha = aAlpha * nearFade * region;
        vShade = aShade;

        gl_PointSize = min(aSize * uScale / dist, 500.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uColor;

    varying float vAlpha;
    varying float vShade;

    void main() {
        float density = texture2D(uMap, gl_PointCoord).a;
        if (density < 0.004) discard;
        gl_FragColor = vec4(uColor * vShade, density * vAlpha);
    }
`;

interface BrainHazeProps {
    focusRegionId?: string | null;
    hoverRegionId?: string | null;
}

/**
 * The smoke inside the brain: a thin, neutral, physically-behaving
 * atmosphere wrapping the connection wiring without replacing it.
 *
 * The rules it's built to, in order of how much they matter:
 *
 *   - NOT additive. Additive blending is what turns any particle layer
 *     into glowing bubbles — every overlap gets brighter until the
 *     middle is a lamp. This draws with normal blending in a neutral
 *     grey, so overlapping puffs settle into haze the way smoke does.
 *   - No colour of its own, and no bloom (GlowLayer's selection covers
 *     the energy pulses only, never this).
 *   - Wide spread of sizes and opacities, several different cloud
 *     sprites (see getHazeTexture — fractal noise with real holes in it,
 *     never a round gradient), and every puff nudged off the line it was
 *     sampled from. Uniform sprites are what read as a particle effect.
 *   - Interior darker than the shell (CORE_SHADE), so the mass has depth
 *     instead of being flat fog.
 *   - Constant slow turbulence in the vertex shader, so the whole field
 *     curls and drifts.
 *
 * Sampled from ALONG the rendered connection lines (see
 * connectionGeometry.ts), so it hugs the network's own shape — including
 * the long tracts crossing the interior — rather than pooling around
 * individual neuron dots.
 */
export default function BrainHaze({ focusRegionId, hoverRegionId }: BrainHazeProps) {
    const puffs = useMemo(() => {
        const connectionCount = connectionPositions.length / 12;
        const count = connectionCount * SAMPLES_PER_CONNECTION;

        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const alphas = new Float32Array(count);
        const phases = new Float32Array(count);
        const shades = new Float32Array(count);
        const regions = new Float32Array(count);

        let n = 0;
        for (let c = 0; c < connectionCount; c++) {
            const i = c * 12;
            const ax = connectionPositions[i], ay = connectionPositions[i + 1], az = connectionPositions[i + 2];
            const mx = connectionPositions[i + 3], my = connectionPositions[i + 4], mz = connectionPositions[i + 5];
            const bx = connectionPositions[i + 9], by = connectionPositions[i + 10], bz = connectionPositions[i + 11];

            // Midpoint of A->M, the bow midpoint M itself, midpoint of
            // M->B: three samples per connection, each as far from the
            // real endpoint nodes as that connection allows, so the smoke
            // never reads as a halo stuck on the dots.
            const samples: [number, number, number][] = [
                [(ax + mx) / 2, (ay + my) / 2, (az + mz) / 2],
                [mx, my, mz],
                [(mx + bx) / 2, (my + by) / 2, (mz + bz) / 2],
            ];

            for (const [sx, sy, sz] of samples) {
                const seed = i + n * 3.7;
                const x = sx + (hash(seed) - 0.5) * SPREAD;
                const y = sy + (hash(seed * 1.7) - 0.5) * SPREAD;
                const z = sz + (hash(seed * 2.9) - 0.5) * SPREAD;

                positions[n * 3] = x;
                positions[n * 3 + 1] = y;
                positions[n * 3 + 2] = z;

                // Sizes skewed hard toward the small end (cubed), so the
                // broad drifts stay the minority they are in real smoke.
                const t = hash(seed * 3.3);
                sizes[n] = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * t * t * t;
                // Bigger puffs are proportionally fainter: a broad drift
                // as dense as a wisp is a cloud, not smoke.
                alphas[n] = (ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * hash(seed * 4.1)) * (1 - t * 0.55);
                phases[n] = hash(seed * 5.9) * 100;

                const rx = x - BRAIN_CENTER[0], ry = y - BRAIN_CENTER[1], rz = z - BRAIN_CENTER[2];
                const radius = Math.min(1, Math.sqrt(rx * rx + ry * ry + rz * rz) / SHELL_RADIUS);
                shades[n] = CORE_SHADE + (1 - CORE_SHADE) * radius;

                let region = -1;
                let bestDistance = Infinity;
                brainRegions.forEach((definition, index) => {
                    const dx = x - definition.anchor[0], dy = y - definition.anchor[1], dz = z - definition.anchor[2];
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (distance <= definition.radius && distance < bestDistance) {
                        bestDistance = distance;
                        region = index;
                    }
                });
                regions[n] = region;

                n++;
            }
        }

        return { positions, sizes, alphas, phases, shades, regions, count };
    }, []);

    // One geometry per cloud sprite, so neighbouring puffs aren't the
    // same stamp. Split by index rather than by position, which keeps
    // every variant spread evenly through the whole volume.
    const variants = useMemo(() => {
        const { positions, sizes, alphas, phases, shades, regions, count } = puffs;
        return Array.from({ length: HAZE_TEXTURE_VARIANTS }, (_, variant) => {
            const indices: number[] = [];
            for (let n = variant; n < count; n += HAZE_TEXTURE_VARIANTS) indices.push(n);

            const pick = (source: Float32Array, stride: number) => {
                const out = new Float32Array(indices.length * stride);
                indices.forEach((index, slot) => {
                    for (let s = 0; s < stride; s++) out[slot * stride + s] = source[index * stride + s];
                });
                return out;
            };

            return {
                positions: pick(positions, 3),
                sizes: pick(sizes, 1),
                alphas: pick(alphas, 1),
                phases: pick(phases, 1),
                shades: pick(shades, 1),
                regions: pick(regions, 1),
            };
        });
    }, [puffs]);

    const materials = useMemo(
        () => Array.from({ length: HAZE_TEXTURE_VARIANTS }, (_, variant) => new ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uScale: { value: 400 },
                uMap: { value: getHazeTexture(variant) },
                uColor: { value: SMOKE_COLOR },
                uLitRegion: { value: -1 },
                uHighlight: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            // Spelled out rather than left to the default, because this
            // one line is what decides whether the layer reads as smoke
            // or as glowing bubbles (see the doc comment above).
            blending: NormalBlending,
        })),
        [],
    );

    const highlight = useRef(0);
    const litRegion = useRef(-1);

    useFrame((state, delta) => {
        const targetId = focusRegionId ?? hoverRegionId ?? null;
        const targetRegion = targetId ? brainRegions.findIndex((region) => region.id === targetId) : -1;
        if (targetRegion >= 0) litRegion.current = targetRegion;
        highlight.current += ((targetRegion >= 0 ? 1 : 0) - highlight.current) * Math.min(1, delta * REGION_FADE_SPEED);
        if (highlight.current < 0.002) highlight.current = 0;

        // Point size in pixels has to track the drawing buffer's own
        // height, or the smoke changes scale with the window.
        const scale = (state.size.height * state.viewport.dpr) / 2;

        materials.forEach((material) => {
            material.uniforms.uTime.value = state.clock.elapsedTime;
            material.uniforms.uScale.value = scale;
            material.uniforms.uLitRegion.value = litRegion.current;
            material.uniforms.uHighlight.value = highlight.current;
        });
    });

    return (
        <>
            {variants.map((variant, index) => (
                <points key={index} material={materials[index]}>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[variant.positions, 3]} />
                        <bufferAttribute attach="attributes-aSize" args={[variant.sizes, 1]} />
                        <bufferAttribute attach="attributes-aAlpha" args={[variant.alphas, 1]} />
                        <bufferAttribute attach="attributes-aPhase" args={[variant.phases, 1]} />
                        <bufferAttribute attach="attributes-aShade" args={[variant.shades, 1]} />
                        <bufferAttribute attach="attributes-aRegion" args={[variant.regions, 1]} />
                    </bufferGeometry>
                </points>
            ))}
        </>
    );
}
