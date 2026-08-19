import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { BufferAttribute, Points } from "three";
import { brainNodes3D } from "../../state/neuralNetwork3D";
import { brainRegions } from "../../state/brainRegions";
import { brainSwirlColor } from "./brainColor";
import { pulseBoost } from "./pulseField";
import { KEPT_NODE_INDICES } from "./keptNodes";
import { nodeRegionIndex, regionIndexOf } from "./regionNodes";
import { getDotTexture } from "./dotTexture";

// Deterministic hash (not Math.random — must stay pure since this runs
// inside a useMemo initializer during render) used for per-node
// brightness variance and rare hotspots.
function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

const STATIC_BOOST = 1.6;

// Region colors pulled out into a plain array once — this is read for
// every visible neuron on every frame, so it shouldn't be a property
// lookup through the definition objects each time.
const regionColors = brainRegions.map((r) => r.rgb);

// Every region carries its own color ALL the time — that's what tells
// the areas apart at a glance (per explicit request, replacing the
// marker icons/rings that used to do that job). Blended with the swirl
// rather than replacing it, so the brain still looks like one living
// field and the ~19% of neurons that belong to no region keep the plain
// swirl, leaving a natural seam between areas.
const REGION_BASE_TINT = 0.88;
const REGION_COLOR_GAIN = 1.25;
// Hovering or opening a region BRIGHTENS that whole section (its smoke
// and its share of the web with it — see BrainHaze and ConnectionLayer)
// while everything else drops well back. The drop does most of the work:
// separation reads better as "the rest recedes" than as "this one
// glows", and it's what makes the chosen area unmistakably the subject.
// Brightness only, no glow sprite over the area — that's what an earlier
// version did and it read as an effect pasted on top of the brain.
const REGION_HIGHLIGHT = 1.0;
const REGION_DIM = 0.62;
// At REST — nothing hovered, no region open — the whole brain sits back
// at this fraction of its full brightness. The highlight below is
// blended FROM here TO the values above, so hovering still arrives at
// exactly the same place it always did (per explicit request: the hover
// is right, only the resting state was too hot).
const IDLE_BRIGHTNESS = 0.68;
// Seconds-ish easing rate for fading that highlight in/out — a hard cut
// on hover read as flickering when the pointer crossed the nav list.
const REGION_FADE_SPEED = 4.5;

interface NeuronLayerProps {
    // Region currently pulled up in the scene (clicked in the nav panel
    // or on the brain itself), and the one merely being hovered — both
    // light the same way, focus just wins when they disagree. See
    // state/brainRegions.ts and regionNodes.ts for the node→region map.
    focusRegionId?: string | null;
    hoverRegionId?: string | null;
}

/**
 * Renders only the neuron particles — no connections, no energy, no glow
 * setup. Deliberately narrow responsibility (per the layered architecture:
 * BrainSystem composes this with ConnectionLayer/EnergyLayer/GlowLayer).
 *
 * Colors come from the shared brainSwirlColor() field (position + a slow
 * time phase) — same function EnergyLayer uses for its pulses, so the
 * whole brain reads as one living color field instead of neurons and
 * pulses looking like two unrelated layers. On top of that, pulseBoost
 * (written every frame by EnergyLayer) is added in — this is what makes
 * the dots a given pulse has swept over visibly light up in that pulse's
 * own color, independently per pulse.
 *
 * Uses raw <points>/<bufferGeometry>/<pointsMaterial> rather than a
 * higher-level drei wrapper — this is the pattern already proven to
 * reliably carry per-vertex colors in this codebase.
 */
export default function NeuronLayer({ focusRegionId, hoverRegionId }: NeuronLayerProps) {
    // Original node indices kept for this thinned point cloud — shared
    // with ConnectionLayer (via keptNodes.ts) so a connection never
    // dangles off to a node that has no visible dot here.
    const keptIndices = KEPT_NODE_INDICES;
    const nodeCount = keptIndices.length;

    const positions = useMemo(() => {
        const arr = new Float32Array(nodeCount * 3);
        keptIndices.forEach((idx, n) => {
            arr[n * 3] = brainNodes3D[idx * 3];
            arr[n * 3 + 1] = brainNodes3D[idx * 3 + 1];
            arr[n * 3 + 2] = brainNodes3D[idx * 3 + 2];
        });
        return arr;
    }, [keptIndices, nodeCount]);

    // Per-node variance/hotspot factors are static — only the underlying
    // swirl color animates — so these are computed once.
    const variance = useMemo(() => {
        const arr = new Float32Array(nodeCount);
        keptIndices.forEach((idx, n) => {
            const isHotspot = hash(idx * 7.13) > 0.985;
            arr[n] = (0.85 + hash(idx) * 0.3) * (isHotspot ? 1.6 : 1);
        });
        return arr;
    }, [keptIndices, nodeCount]);

    const colors = useMemo(() => new Float32Array(nodeCount * 3), [nodeCount]);
    const pointsRef = useRef<Points>(null);
    // Eased 0→1 strength of the region highlight, plus which region it's
    // currently showing. Kept in refs (not state) because it changes every
    // frame — re-rendering React for it would be pointless churn.
    const highlight = useRef(0);
    const litRegion = useRef(-1);

    useFrame((state, delta) => {
        const attr = pointsRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (!attr) return;
        const time = state.clock.elapsedTime;

        const targetRegion = regionIndexOf(focusRegionId ?? hoverRegionId ?? null);
        if (targetRegion >= 0) litRegion.current = targetRegion;
        const target = targetRegion >= 0 ? 1 : 0;
        const step = Math.min(1, delta * REGION_FADE_SPEED);
        highlight.current += (target - highlight.current) * step;
        if (highlight.current < 0.002) highlight.current = 0;

        const strength = highlight.current;
        const lit = litRegion.current;

        for (let n = 0; n < nodeCount; n++) {
            const x = positions[n * 3];
            const y = positions[n * 3 + 1];
            const z = positions[n * 3 + 2];

            const base = brainSwirlColor(x, y, z, time);
            const v = variance[n];
            const boostIdx = keptIndices[n] * 3;

            // These dots aren't part of GlowLayer's SelectiveBloom
            // selection (only pulses/hover lines are), so now that those
            // got much brighter over several rounds of tuning, the plain
            // dots started reading as faded out by comparison. STATIC_BOOST
            // brings their own baseline brightness back up to compete.
            let r = base[0] * v * STATIC_BOOST;
            let g = base[1] * v * STATIC_BOOST;
            let b = base[2] * v * STATIC_BOOST;

            const region = nodeRegionIndex[n];
            if (region >= 0) {
                // Blended toward the region color at a gentler gain than
                // STATIC_BOOST: pushed to full brightness the colors all
                // clipped past 1 and came back out as the same near-white,
                // which is exactly what the regions must NOT look like.
                const color = regionColors[region];
                const gain = v * REGION_COLOR_GAIN;
                r += (color[0] * gain - r) * REGION_BASE_TINT;
                g += (color[1] * gain - g) * REGION_BASE_TINT;
                b += (color[2] * gain - b) * REGION_BASE_TINT;
            }

            // Brightness only — the color already says which region a
            // neuron belongs to, so lighting one up is just turning it
            // up, not repainting it.
            const target = region === lit ? 1 + REGION_HIGHLIGHT : 1 - REGION_DIM;
            const scale = IDLE_BRIGHTNESS + (target - IDLE_BRIGHTNESS) * strength;
            r *= scale;
            g *= scale;
            b *= scale;

            attr.setXYZ(
                n,
                Math.min(1, r + pulseBoost[boostIdx]),
                Math.min(1, g + pulseBoost[boostIdx + 1]),
                Math.min(1, b + pulseBoost[boostIdx + 2]),
            );
        }

        attr.needsUpdate = true;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial
                vertexColors
                map={getDotTexture()}
                alphaTest={0.05}
                size={0.034}
                sizeAttenuation
                transparent
                depthWrite={false}
            />
        </points>
    );
}
