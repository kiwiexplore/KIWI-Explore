import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, NormalBlending, ShaderMaterial, type Group, type PerspectiveCamera, type Points } from "three";
import { DoubleSide, RingGeometry, Vector3 } from "three";
import { Html } from "@react-three/drei";
import {
    getStarTexture, getDistantGalaxyTexture,
    getMoonTexture, getEarthTexture, getSunGlareTexture,
    getPlanetTexture, getRingTexture,
} from "./spaceTextures";
import { PLANETS, orbitOffset, planetRadius } from "./solarSystem";
import { MOON_POSITION, MOON_RADIUS } from "./moonPlacement";
import { getHazeTexture, HAZE_TEXTURE_VARIANTS } from "./dotTexture";
import { buildBandStars, buildBandGlow, buildDustLanes } from "./milkyWay";
import "./SpaceBackdrop.css";

// Deterministic (a hash, not Math.random): the sky should be the same
// every time the app opens, not reshuffled per session.
function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

// --- the depth layers, from far to near -----------------------------
// Distances are in the scene's own units; the brain is ~1.4 across.
// The gaps between these are what create the sense of volume: a sky
// where everything sits at one radius is a wallpaper on a sphere.
const FIELD_STARS = 5600;
const FIELD_MIN_RADIUS = 260;
const FIELD_MAX_RADIUS = 900;

// Earth: the same kind of object, three and a half times further out — and so
// noticeably smaller on screen even though it's the bigger body. Sits
// BEHIND the Moon, along roughly the same line of sight but well past
// it and offset just enough not to hide behind it: two bodies on one
// bearing at very different depths is the clearest possible statement
// of "that one is near, that one is far".
const EARTH_POSITION: [number, number, number] = [13.5, 2.4, -23];
// Earth is 3.67x the Moon's radius — the real ratio, not a number
// picked to look right. Sitting 3.5x further away, it therefore ends up
// very slightly LARGER on screen than the nearby Moon, which is exactly
// the relationship an observer near the Moon would see.
const EARTH_RADIUS = MOON_RADIUS * 3.67;

// The Sun: far beyond both, but close enough now to be a recognizable
// disc rather than just another star — and it's what actually lights
// them. Up and to the right, since the left of the frame belongs to the
// nav rail and anything there ends up behind UI.
const SUN_POSITION: [number, number, number] = [34, 19, -58];
const SUN_RADIUS = 0.72;
// A tight halo a few disc-widths across. Not a corona, not a flare.
const SUN_GLARE_SCALE = 8;

// The Milky Way, as a real distribution rather than an object (see
// milkyWay.ts). Its stars sit beyond the general field; the unresolved
// glow further still; and the dust NEARER than that glow, because dust
// only reads as dust when it genuinely blocks the light behind it.
//
// There is no galaxy plane, no disc, no spiral: from inside the disk
// there's no viewpoint that could show one, and an earlier version that
// put a galaxy image in the sky read as looking AT the Milky Way from
// outside, which is the one thing this can never be.
const BAND_STARS = 30000;
const BAND_MIN_RADIUS = 700;
const BAND_MAX_RADIUS = 1600;
const BAND_GLOW_POINTS = 4200;
const BAND_GLOW_MIN_RADIUS = 1250;
const BAND_GLOW_MAX_RADIUS = 1750;
const DUST_POINTS = 2200;
const DUST_MIN_RADIUS = 600;
const DUST_MAX_RADIUS = 1050;

const DISTANT_GALAXIES = 9;

const MOTES = 220;
const MOTE_MIN_RADIUS = 3.2;
const MOTE_MAX_RADIUS = 9;

// Stars are point sources: a fixed pixel size, not a world-space size
// that grows as you approach. Nothing in this scene ever gets close
// enough to a star for that to be wrong, and it's what keeps them
// reading as stars rather than as particles.
const starVertexShader = /* glsl */ `
    attribute float aSize;
    attribute vec3 aColor;

    uniform float uPixelRatio;

    varying vec3 vColor;

    void main() {
        vColor = aColor;
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const starFragmentShader = /* glsl */ `
    uniform sampler2D uMap;

    varying vec3 vColor;

    void main() {
        float intensity = texture2D(uMap, gl_PointCoord).a;
        if (intensity < 0.01) discard;
        gl_FragColor = vec4(vColor, intensity);
    }
`;

// Foreground motes drift very slowly, which is the only motion in the
// environment — enough to tell the eye this is a volume being moved
// through, not a backdrop.
const moteVertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;

    uniform float uTime;
    uniform float uScale;

    varying float vAlpha;

    void main() {
        float t = uTime * 0.03 + aPhase;
        vec3 drift = vec3(sin(t) * 0.5, cos(t * 0.8) * 0.4, sin(t * 1.1) * 0.5);

        vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);
        float dist = -mvPosition.z;

        vAlpha = smoothstep(1.5, 5.0, dist) * 0.5;
        gl_PointSize = min(aSize * uScale / dist, 6.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const moteFragmentShader = /* glsl */ `
    uniform sampler2D uMap;

    varying float vAlpha;

    void main() {
        float intensity = texture2D(uMap, gl_PointCoord).a;
        if (intensity < 0.01) discard;
        gl_FragColor = vec4(vec3(0.72, 0.75, 0.82), intensity * vAlpha);
    }
`;

// --- solid bodies (the Moon and Earth) ------------------------------
// Shaded like the real thing: lit from the Sun's direction, a night side
// that goes nearly black, and — only for a world that has one — a thin
// atmospheric rim. Nothing here emits light of its own; a planet that
// glows is the giveaway that a scene isn't physical.
const bodyVertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec2 vUv;

    void main() {
        vUv = uv;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const bodyFragmentShader = /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uLightDirection;
    uniform vec3 uAtmosphere;
    uniform float uTerminator;

    varying vec3 vNormal;
    varying vec3 vView;
    varying vec2 vUv;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 base = texture2D(uMap, vUv).rgb;

        // How soft the day/night line is: an atmosphere scatters light
        // around it, an airless body cuts it off almost sharply.
        float lambert = dot(normal, normalize(uLightDirection));
        float day = smoothstep(-uTerminator, uTerminator, lambert);

        // The night side is lit only by the faint starlight around it.
        vec3 lit = base * (0.015 + 0.985 * day);

        // The atmosphere seen edge-on is a thin bright rim, and only
        // where the Sun is actually hitting it. Zero for the Moon.
        float fresnel = pow(1.0 - max(0.0, dot(normal, normalize(vView))), 4.5);
        vec3 atmosphere = uAtmosphere * fresnel * day;

        gl_FragColor = vec4(lit + atmosphere, 1.0);
    }
`;

/**
 * A planet's material: the same shading as the Moon and Earth, since
 * they're the same kind of object — a lit sphere with a night side.
 * Built per planet (each has its own texture) but from one definition.
 */
function makeBodyMaterial(map: ReturnType<typeof getPlanetTexture>, terminator: number): ShaderMaterial {
    return new ShaderMaterial({
        vertexShader: bodyVertexShader,
        fragmentShader: bodyFragmentShader,
        uniforms: {
            uMap: { value: map },
            uLightDirection: { value: new Vector3(0, 0, 1) },
            uAtmosphere: { value: new Vector3(0, 0, 0) },
            uTerminator: { value: terminator },
        },
    });
}

const moonMaterial = new ShaderMaterial({
    vertexShader: bodyVertexShader,
    fragmentShader: bodyFragmentShader,
    uniforms: {
        uMap: { value: getMoonTexture() },
        uLightDirection: { value: new Vector3(0, 0, 1) },
        // No atmosphere at all, and a hard terminator: the Moon's
        // day/night line is a knife edge, which is most of why lunar
        // photographs look the way they do.
        uAtmosphere: { value: new Vector3(0, 0, 0) },
        uTerminator: { value: 0.06 },
    },
});

const earthMaterial = new ShaderMaterial({
    vertexShader: bodyVertexShader,
    fragmentShader: bodyFragmentShader,
    uniforms: {
        uMap: { value: getEarthTexture() },
        uLightDirection: { value: new Vector3(0, 0, 1) },
        // A thin, restrained blue rim — the atmosphere is 1% of Earth's
        // radius, and anything more than a hairline here is the "glowing
        // sci-fi planet" look rather than the view from orbit.
        uAtmosphere: { value: new Vector3(0.16, 0.28, 0.42) },
        uTerminator: { value: 0.16 },
    },
});

// The band's diffuse layers — glow and dust — are the same geometry with
// opposite jobs, so they share a shader and differ only in colour and
// blending. Sizes are in world units here (unlike the stars, which are
// point sources at a fixed pixel size), because these are volumes.
const cloudVertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aOpacity;
    attribute float aWarmth;

    uniform float uScale;

    varying float vOpacity;
    varying float vWarmth;

    void main() {
        vOpacity = aOpacity;
        vWarmth = aWarmth;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const cloudFragmentShader = /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uCool;
    uniform vec3 uWarm;

    varying float vOpacity;
    varying float vWarmth;

    void main() {
        float density = texture2D(uMap, gl_PointCoord).a;
        if (density < 0.004) discard;
        gl_FragColor = vec4(mix(uCool, uWarm, vWarmth), density * vOpacity);
    }
`;

function makeCloudMaterial(variant: number, cool: Vector3, warm: Vector3, blending: typeof AdditiveBlending | typeof NormalBlending): ShaderMaterial {
    return new ShaderMaterial({
        vertexShader: cloudVertexShader,
        fragmentShader: cloudFragmentShader,
        uniforms: {
            uMap: { value: getHazeTexture(variant) },
            uScale: { value: 400 },
            uCool: { value: cool },
            uWarm: { value: warm },
        },
        transparent: true,
        depthWrite: false,
        blending,
    });
}

// Starlight adds; dust subtracts by covering. Hence the two blendings.
const glowMaterials = Array.from({ length: HAZE_TEXTURE_VARIANTS }, (_, variant) => makeCloudMaterial(
    variant,
    new Vector3(0.58, 0.63, 0.76),
    new Vector3(0.85, 0.74, 0.58),
    AdditiveBlending,
));
const dustMaterials = Array.from({ length: HAZE_TEXTURE_VARIANTS }, (_, variant) => makeCloudMaterial(
    variant,
    new Vector3(0.03, 0.035, 0.05),
    new Vector3(0.05, 0.035, 0.028),
    NormalBlending,
));

// The band's own stars, with their own material so the two populations
// can be tuned apart from the general field.
const bandStarMaterial = new ShaderMaterial({
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    uniforms: {
        uMap: { value: getStarTexture() },
        uPixelRatio: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
});

const starMaterial = new ShaderMaterial({
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    uniforms: {
        uMap: { value: getStarTexture() },
        uPixelRatio: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    // Starlight adds: two stars in the same pixel are brighter than one.
    blending: AdditiveBlending,
});

const moteMaterial = new ShaderMaterial({
    vertexShader: moteVertexShader,
    fragmentShader: moteFragmentShader,
    uniforms: {
        uMap: { value: getStarTexture() },
        uTime: { value: 0 },
        uScale: { value: 400 },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
});

// Every planet, placed on its own orbit around the Sun and lit from it.
// Built once: none of this changes at runtime.
const planets = PLANETS.map((planet) => {
    // On its own orbit around the Sun...
    const offset = orbitOffset(planet);
    const position: [number, number, number] = [
        SUN_POSITION[0] + offset[0],
        SUN_POSITION[1] + offset[1],
        SUN_POSITION[2] + offset[2],
    ];
    // ...and drawn at whatever size makes its apparent size right from
    // here. The viewer is near the origin; the planets are far enough
    // away that the camera's own orbit doesn't change this materially.
    const sceneDistance = Math.hypot(position[0], position[1], position[2]);

    const material = makeBodyMaterial(
        getPlanetTexture(planet.id, planet.palette),
        // Thick atmospheres soften the day/night line; airless Mercury's
        // is nearly a knife edge.
        planet.id === "mercury" ? 0.07 : 0.2,
    );
    (material.uniforms.uLightDirection.value as Vector3)
        .set(SUN_POSITION[0] - position[0], SUN_POSITION[1] - position[1], SUN_POSITION[2] - position[2])
        .normalize();

    const radius = planetRadius(planet, sceneDistance);

    // Ring UVs have to be RADIAL. three's RingGeometry lays its uvs out
    // on a square grid, so a strip texture painted across it smears
    // diagonally instead of forming rings — which is precisely what made
    // Saturn look wrong. Rewriting u as "how far out from the inner edge
    // this vertex sits" turns the same strip into real ring bands.
    let rings = null;
    if (planet.rings) {
        const geometry = new RingGeometry(radius * planet.rings.inner, radius * planet.rings.outer, 160, 1);
        const positions = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        const inner = radius * planet.rings.inner;
        const outer = radius * planet.rings.outer;
        const vertex = new Vector3();
        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            uv.setXY(i, (vertex.length() - inner) / (outer - inner), 0.5);
        }
        uv.needsUpdate = true;
        rings = { geometry, tilt: planet.rings.tilt };
    }

    return { planet, position, radius, material, rings };
});

// Every named body in the environment, for the labels below.
const LABELLED_BODIES: { id: string; label: string; position: [number, number, number]; radius: number }[] = [
    { id: "sun", label: "Sun", position: SUN_POSITION, radius: SUN_RADIUS },
    { id: "moon", label: "Moon", position: MOON_POSITION, radius: MOON_RADIUS },
    { id: "earth", label: "Earth", position: EARTH_POSITION, radius: EARTH_RADIUS },
    ...planets.map(({ planet, position, radius }) => ({
        id: planet.id, label: planet.label, position, radius,
    })),
];

const labelWorld = new Vector3();
const labelForward = new Vector3();
const toLabel = new Vector3();

/**
 * The bodies' names, pinned beside them.
 *
 * Faint on purpose (see SpaceBackdrop.css): a sky with bright captions
 * all over it stops being a sky. Each name sits just UNDER its body,
 * pushed down by that body's own apparent size in pixels so it clears
 * the disc without floating away from it, and hidden entirely when the
 * body is behind the camera — drei projects points behind the viewer
 * back onto the screen, which would otherwise scatter names across the
 * wrong half of the frame.
 */
function BodyLabels() {
    const groupRefs = useRef<(Group | null)[]>([]);
    const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

    useFrame((state) => {
        state.camera.getWorldDirection(labelForward);
        const camera = state.camera as PerspectiveCamera;
        // Pixels per radian at the current field of view — the bridge
        // between a body's angular size and how far down the screen its
        // name has to sit.
        const pixelsPerRadian = state.size.height / (2 * Math.tan((camera.fov * Math.PI) / 360));

        for (let i = 0; i < LABELLED_BODIES.length; i++) {
            const group = groupRefs.current[i];
            const label = labelRefs.current[i];
            if (!group || !label) continue;

            group.getWorldPosition(labelWorld);
            toLabel.copy(labelWorld).sub(state.camera.position);
            const distance = toLabel.length();
            toLabel.divideScalar(distance || 1);

            if (toLabel.dot(labelForward) <= 0.3) {
                label.style.display = "none";
                continue;
            }
            label.style.display = "";

            // Sit the name just under the disc, wherever the disc
            // happens to be on screen. Doing this in pixels rather than
            // as a fixed offset in the scene is what makes it work for
            // both the Moon a few units away and Neptune hundreds out:
            // a world-space offset that clears the Moon is invisible on
            // Neptune, and one that clears Neptune throws the Moon's
            // name off the bottom of the screen.
            const radiusPixels = (LABELLED_BODIES[i].radius / distance) * pixelsPerRadian;
            label.style.transform = `translateY(${Math.round(radiusPixels + 12)}px)`;
        }
    });

    return (
        <group>
            {LABELLED_BODIES.map((body, index) => (
                <group
                    key={body.id}
                    position={body.position}
                    ref={(node) => { groupRefs.current[index] = node; }}
                >
                    <Html center zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
                        <div ref={(node) => { labelRefs.current[index] = node; }} className="space-label">
                            {body.label}
                        </div>
                    </Html>
                </group>
            ))}
        </group>
    );
}

/** A point on a sphere of the given radius, evenly distributed. */
function pointOnSphere(seed: number, radius: number): [number, number, number] {
    // Uniform on the sphere: cos(phi) has to be sampled evenly, not phi
    // itself, or everything piles up at the poles.
    const u = hash(seed) * 2 - 1;
    const theta = hash(seed * 1.7) * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return [radius * s * Math.cos(theta), radius * u, radius * s * Math.sin(theta)];
}

/**
 * The deep-space environment the brain sits in.
 *
 * Five layers at genuinely different distances, because depth is what
 * separates a place from a wallpaper:
 *
 *   1. Thousands of field stars, spread through a shell 120-320 units
 *      out, in real stellar colours (mostly white, some blue-white, some
 *      warm) and a realistic brightness distribution — nearly all faint,
 *      a handful bright.
 *   2. The Milky Way as a BAND across the sky rather than a disc in
 *      front of you — we are inside this galaxy, so its plane wraps the
 *      whole scene: brightest toward the galactic centre, split by dust
 *      lanes nearer than the light they block (see milkyWay.ts). An
 *      earlier version hung an Andromeda disc behind the brain, which is
 *      a view from outside a galaxy we are in fact inside.
 *   3. A few unresolved distant galaxies, small and dim.
 *   4. Very faint interstellar dust at intermediate range, dark and
 *      desaturated — visible mostly as places where the stars behind it
 *      are slightly muted.
 *   5. A little dust drifting through the foreground, the only thing in
 *      the environment that moves.
 *
 * Everything here is drawn dark and unsaturated on purpose. The scene's
 * light is meant to come from the stars and the galaxy, with the brain
 * as the one bright artificial thing in it — not from a coloured sci-fi
 * wash over the whole sky.
 *
 * This replaced a single photo mapped onto a sphere. A photo is one
 * distance by definition: it can turn with the camera, but it can never
 * have anything in front of anything else.
 */
export default function SpaceBackdrop() {
    const field = useMemo(() => {
        const positions = new Float32Array(FIELD_STARS * 3);
        const colors = new Float32Array(FIELD_STARS * 3);
        const sizes = new Float32Array(FIELD_STARS);

        for (let i = 0; i < FIELD_STARS; i++) {
            const seed = i * 3.7 + 11;
            const radius = FIELD_MIN_RADIUS + hash(seed * 2.3) * (FIELD_MAX_RADIUS - FIELD_MIN_RADIUS);
            const [x, y, z] = pointOnSphere(seed, radius);
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Brightness: a steep power curve, so the sky is mostly very
            // faint stars with a few bright ones — the actual
            // distribution, and the reason a real night sky reads as
            // deep rather than as an even sprinkle.
            const magnitude = Math.pow(hash(seed * 5.1), 3.2);
            const brightness = 0.16 + magnitude * 0.84;

            // Stellar colour: most white, a minority blue-white or warm.
            const temperature = hash(seed * 7.9);
            let r = 1, g = 1, b = 1;
            if (temperature > 0.82) { r = 0.72; g = 0.8; b = 1; }
            else if (temperature < 0.14) { r = 1; g = 0.86; b = 0.72; }

            colors[i * 3] = r * brightness;
            colors[i * 3 + 1] = g * brightness;
            colors[i * 3 + 2] = b * brightness;
            sizes[i] = 0.9 + magnitude * 2.6;
        }

        return { positions, colors, sizes };
    }, []);

    const band = useMemo(() => buildBandStars(BAND_STARS, BAND_MIN_RADIUS, BAND_MAX_RADIUS), []);
    const glow = useMemo(() => buildBandGlow(BAND_GLOW_POINTS, BAND_GLOW_MIN_RADIUS, BAND_GLOW_MAX_RADIUS), []);
    const dustLanes = useMemo(() => buildDustLanes(DUST_POINTS, DUST_MIN_RADIUS, DUST_MAX_RADIUS), []);

    // Split across the cloud sprites, so no two neighbouring puffs are
    // the same stamp.
    const cloudSlices = useMemo(() => {
        const slice = (cloud: typeof glow, variant: number) => {
            const indices: number[] = [];
            for (let i = variant; i < cloud.sizes.length; i += HAZE_TEXTURE_VARIANTS) indices.push(i);
            const positions = new Float32Array(indices.length * 3);
            const sizes = new Float32Array(indices.length);
            const opacities = new Float32Array(indices.length);
            const warmth = new Float32Array(indices.length);
            indices.forEach((index, slot) => {
                positions[slot * 3] = cloud.positions[index * 3];
                positions[slot * 3 + 1] = cloud.positions[index * 3 + 1];
                positions[slot * 3 + 2] = cloud.positions[index * 3 + 2];
                sizes[slot] = cloud.sizes[index];
                opacities[slot] = cloud.opacities[index];
                warmth[slot] = cloud.warmth[index];
            });
            return { positions, sizes, opacities, warmth };
        };

        return {
            glow: Array.from({ length: HAZE_TEXTURE_VARIANTS }, (_, variant) => slice(glow, variant)),
            dust: Array.from({ length: HAZE_TEXTURE_VARIANTS }, (_, variant) => slice(dustLanes, variant)),
        };
    }, [glow, dustLanes]);

    const motes = useMemo(() => {
        const positions = new Float32Array(MOTES * 3);
        const sizes = new Float32Array(MOTES);
        const phases = new Float32Array(MOTES);

        for (let i = 0; i < MOTES; i++) {
            const seed = i * 9.13 + 3;
            const radius = MOTE_MIN_RADIUS + hash(seed) * (MOTE_MAX_RADIUS - MOTE_MIN_RADIUS);
            const [x, y, z] = pointOnSphere(seed * 1.9, radius);
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            sizes[i] = 0.02 + hash(seed * 2.7) * 0.05;
            phases[i] = hash(seed * 4.3) * 100;
        }

        return { positions, sizes, phases };
    }, []);

    const galaxies = useMemo(() => Array.from({ length: DISTANT_GALAXIES }, (_, i) => {
        const seed = i * 17.3 + 7;
        const radius = 150 + hash(seed) * 140;
        return {
            position: pointOnSphere(seed * 2.9, radius),
            scale: radius * (0.014 + hash(seed * 3.1) * 0.03),
            variant: i,
            opacity: 0.35 + hash(seed * 4.9) * 0.4,
        };
    }), []);

    const motesRef = useRef<Points>(null);

    useFrame((state) => {
        const cloudScale = (state.size.height * state.viewport.dpr) / 2;
        starMaterial.uniforms.uPixelRatio.value = state.viewport.dpr;
        bandStarMaterial.uniforms.uPixelRatio.value = state.viewport.dpr;
        glowMaterials.forEach((material) => { material.uniforms.uScale.value = cloudScale; });
        dustMaterials.forEach((material) => { material.uniforms.uScale.value = cloudScale; });
        // Both bodies are lit from wherever the Sun actually is, rather
        // than from hand-picked directions that would drift out of step
        // the moment anything moves.
        (moonMaterial.uniforms.uLightDirection.value as Vector3)
            .set(SUN_POSITION[0] - MOON_POSITION[0], SUN_POSITION[1] - MOON_POSITION[1], SUN_POSITION[2] - MOON_POSITION[2])
            .normalize();
        (earthMaterial.uniforms.uLightDirection.value as Vector3)
            .set(SUN_POSITION[0] - EARTH_POSITION[0], SUN_POSITION[1] - EARTH_POSITION[1], SUN_POSITION[2] - EARTH_POSITION[2])
            .normalize();
        moteMaterial.uniforms.uTime.value = state.clock.elapsedTime;
        moteMaterial.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / 2;
    });

    return (
        <group>
            {/* 1. The star field. */}
            <points material={starMaterial} frustumCulled={false}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[field.positions, 3]} />
                    <bufferAttribute attach="attributes-aColor" args={[field.colors, 3]} />
                    <bufferAttribute attach="attributes-aSize" args={[field.sizes, 1]} />
                </bufferGeometry>
            </points>

            {/* 2. The Milky Way: its own dense star population along the
                galactic plane, the unresolved glow behind that, and the
                dust in front of the glow, blocking it. */}
            <points material={bandStarMaterial} frustumCulled={false}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[band.positions, 3]} />
                    <bufferAttribute attach="attributes-aColor" args={[band.colors, 3]} />
                    <bufferAttribute attach="attributes-aSize" args={[band.sizes, 1]} />
                </bufferGeometry>
            </points>

            {cloudSlices.glow.map((slice, variant) => (
                <points key={`glow-${variant}`} material={glowMaterials[variant]} frustumCulled={false}>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[slice.positions, 3]} />
                        <bufferAttribute attach="attributes-aSize" args={[slice.sizes, 1]} />
                        <bufferAttribute attach="attributes-aOpacity" args={[slice.opacities, 1]} />
                        <bufferAttribute attach="attributes-aWarmth" args={[slice.warmth, 1]} />
                    </bufferGeometry>
                </points>
            ))}

            {cloudSlices.dust.map((slice, variant) => (
                <points key={`dust-${variant}`} material={dustMaterials[variant]} frustumCulled={false}>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[slice.positions, 3]} />
                        <bufferAttribute attach="attributes-aSize" args={[slice.sizes, 1]} />
                        <bufferAttribute attach="attributes-aOpacity" args={[slice.opacities, 1]} />
                        <bufferAttribute attach="attributes-aWarmth" args={[slice.warmth, 1]} />
                    </bufferGeometry>
                </points>
            ))}

            {/* 3. The Moon: nearest body, lit by the Sun below. */}
            <mesh position={MOON_POSITION}>
                <sphereGeometry args={[MOON_RADIUS, 64, 48]} />
                <primitive object={moonMaterial} attach="material" />
            </mesh>

            {/* 4. Earth, three times further out. */}
            <mesh position={EARTH_POSITION} rotation={[0, 2.1, 0.41]}>
                <sphereGeometry args={[EARTH_RADIUS, 64, 48]} />
                <primitive object={earthMaterial} attach="material" />
            </mesh>

            {/* 5. The Sun: a small disc with a tight halo, far out. */}
            <group position={SUN_POSITION}>
                <mesh>
                    <sphereGeometry args={[SUN_RADIUS, 24, 16]} />
                    <meshBasicMaterial color="#fff6e6" toneMapped={false} />
                </mesh>
                <sprite scale={[SUN_RADIUS * SUN_GLARE_SCALE, SUN_RADIUS * SUN_GLARE_SCALE, 1]}>
                    <spriteMaterial
                        map={getSunGlareTexture()}
                        transparent
                        depthWrite={false}
                        blending={AdditiveBlending}
                        toneMapped={false}
                    />
                </sprite>
            </group>

            {/* 6. The rest of the Solar System, out around the Sun. */}
            {planets.map(({ planet, position, radius, material, rings }) => (
                <group key={planet.id} position={position}>
                    <mesh>
                        <sphereGeometry args={[radius, 32, 24]} />
                        <primitive object={material} attach="material" />
                    </mesh>
                    {rings && (
                        <mesh rotation={[Math.PI / 2 - rings.tilt, 0, 0.3]}>
                            <primitive object={rings.geometry} attach="geometry" />
                            <meshBasicMaterial
                                map={getRingTexture()}
                                side={DoubleSide}
                                transparent
                                // Quieter than the planet itself: the
                                // rings are dusty ice catching sunlight,
                                // not a lit band.
                                opacity={0.45}
                                depthWrite={false}
                                toneMapped={false}
                            />
                        </mesh>
                    )}
                </group>
            ))}

            {/* 7. Distant galaxies. */}
            {galaxies.map((galaxy, index) => (
                <mesh key={index} position={galaxy.position} rotation={[0, 0, hash(index * 3.3) * Math.PI]} frustumCulled={false}>
                    <planeGeometry args={[galaxy.scale, galaxy.scale]} />
                    <meshBasicMaterial
                        map={getDistantGalaxyTexture(galaxy.variant)}
                        transparent
                        opacity={galaxy.opacity}
                        depthWrite={false}
                        blending={AdditiveBlending}
                        toneMapped={false}
                    />
                </mesh>
            ))}

            {/* The bodies' names, faintly, beside each one. */}
            <BodyLabels />

            {/* 9. Foreground dust drifting past the camera. */}
            <points ref={motesRef} material={moteMaterial} frustumCulled={false}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[motes.positions, 3]} />
                    <bufferAttribute attach="attributes-aSize" args={[motes.sizes, 1]} />
                    <bufferAttribute attach="attributes-aPhase" args={[motes.phases, 1]} />
                </bufferGeometry>
            </points>
        </group>
    );
}
