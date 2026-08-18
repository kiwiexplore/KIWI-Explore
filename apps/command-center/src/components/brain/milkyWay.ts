/**
 * The Milky Way, built the way we actually see it: from INSIDE it.
 *
 * There is no galaxy object here, and that's the whole point. The Solar
 * System sits within the galactic disk, so there is no vantage point
 * from which its spiral could be seen — what an observer gets instead is
 * depth. Looking along the plane of the disk means looking through
 * thousands of light years of stars that overlap into a bright band;
 * looking away from it means looking out of the disk after a few hundred,
 * into almost nothing.
 *
 * So the band here is not drawn. It EMERGES, from three things placed in
 * three dimensions around the viewer:
 *
 *   - stars, distributed with a density that falls off sharply away from
 *     the galactic plane and rises toward the galactic centre;
 *   - a diffuse glow standing in for the countless stars too faint to
 *     resolve individually, which is what makes the band look milky;
 *   - dark clouds of interstellar dust, placed NEARER than that glow so
 *     they genuinely block it, which is what carves the lanes.
 *
 * Turn the camera and it behaves correctly on its own: the band sweeps
 * past, thins as you look out of the plane, and has no edge anywhere,
 * because there's nothing to have an edge.
 */

function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

// The galactic plane's normal. Chosen so the plane itself passes
// through the scene's default line of sight — the band has to cross the
// view, not sit behind the viewer — and tilted so it runs diagonally
// rather than level with the frame.
const PLANE_NORMAL: [number, number, number] = normalize([0.47, -0.82, -0.35]);
// Direction of the galactic centre: the densest, warmest stretch of the
// band. Perpendicular to the normal above, i.e. lying in the plane, and
// placed ahead and to the left so it's part of the default view.
const CENTRE_DIRECTION: [number, number, number] = normalize([-0.45, 0.12, -0.88]);

// How tightly the stars hug the plane. Small: the disk is thin compared
// with its width, which is exactly why the band is a band.
const PLANE_THICKNESS = 0.09;
// How much denser it gets toward the galactic centre.
const CENTRE_CONCENTRATION = 1.5;

function normalize(v: [number, number, number]): [number, number, number] {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** A uniformly distributed direction on the sphere. */
function randomDirection(seed: number): [number, number, number] {
    const u = hash(seed) * 2 - 1;
    const theta = hash(seed * 1.7) * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return [s * Math.cos(theta), u, s * Math.sin(theta)];
}

/**
 * A direction drawn from the galaxy's own density: hugging the plane,
 * and favouring the half of the sky the centre is in.
 *
 * Rejection sampling rather than a closed form — the density is a
 * product of two falloffs and this stays readable, runs once at load,
 * and is trivially adjustable.
 */
function galacticDirection(seed: number): [number, number, number] {
    for (let attempt = 0; attempt < 60; attempt++) {
        const direction = randomDirection(seed * 7.3 + attempt * 13.7);
        const outOfPlane = Math.abs(dot(direction, PLANE_NORMAL));
        const planeDensity = Math.exp(-((outOfPlane / PLANE_THICKNESS) ** 2));
        const centreDensity = 1 + CENTRE_CONCENTRATION * Math.max(0, dot(direction, CENTRE_DIRECTION));
        if (hash(seed * 3.1 + attempt * 5.9) < planeDensity * centreDensity / (1 + CENTRE_CONCENTRATION)) {
            return direction;
        }
    }
    return randomDirection(seed * 2.9);
}

export interface BandStars {
    positions: Float32Array;
    colors: Float32Array;
    sizes: Float32Array;
}

/**
 * The band's own stars: an enormous number of faint ones, packed along
 * the plane. The brightness curve is steep on purpose — a band made of
 * a few bright stars reads as a decoration, one made of thousands of
 * barely-there ones reads as distance.
 */
export function buildBandStars(count: number, minRadius: number, maxRadius: number): BandStars {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const seed = i * 1.37 + 19;
        const direction = galacticDirection(seed);
        const radius = minRadius + hash(seed * 4.7) * (maxRadius - minRadius);

        positions[i * 3] = direction[0] * radius;
        positions[i * 3 + 1] = direction[1] * radius;
        positions[i * 3 + 2] = direction[2] * radius;

        // Steep, but not so steep that the band disappears: the whole
        // effect is thousands of faint stars adding up, so the faint end
        // has to be visible at all.
        const magnitude = Math.pow(hash(seed * 5.3), 2.8);
        const brightness = 0.22 + magnitude * 0.78;

        // Warmer toward the centre, where the old stellar populations
        // are; cooler out along the arms.
        const towardCentre = Math.max(0, dot(direction, CENTRE_DIRECTION));
        const temperature = hash(seed * 8.9);
        let r = 1, g = 1, b = 1;
        if (temperature > 0.78) { r = 0.74; g = 0.82; b = 1; }
        else if (temperature < 0.3 || towardCentre > 0.6) { r = 1; g = 0.88; b = 0.74; }

        colors[i * 3] = r * brightness;
        colors[i * 3 + 1] = g * brightness;
        colors[i * 3 + 2] = b * brightness;
        sizes[i] = 0.85 + magnitude * 2.1;
    }

    return { positions, colors, sizes };
}

export interface CloudPoints {
    positions: Float32Array;
    sizes: Float32Array;
    opacities: Float32Array;
    /** 0 = cool, 1 = warm. Drives the colour blend in the shader. */
    warmth: Float32Array;
}

/**
 * The unresolved glow: everything in the band too far away to be seen as
 * a star, which is most of it. Hugs the plane even more tightly than the
 * stars do, and piles up toward the centre.
 */
export function buildBandGlow(count: number, minRadius: number, maxRadius: number): CloudPoints {
    // Built the same way the brain's smoke is (see BrainHaze), because
    // the problem is the same one: a handful of big soft sprites reads
    // as blobs, while many small faint ones at a wide spread of sizes
    // reads as a medium. Sizes are skewed hard toward the small end and
    // every puff is nudged off its own direction, so nothing lines up.
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const warmth = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const seed = i * 2.71 + 41;
        const direction = galacticDirection(seed);
        const radius = minRadius + hash(seed * 3.3) * (maxRadius - minRadius);

        // Nudged off its own direction, so the puffs never sit on a
        // clean shell.
        const jitter = radius * 0.06;
        positions[i * 3] = direction[0] * radius + (hash(seed * 12.1) - 0.5) * jitter;
        positions[i * 3 + 1] = direction[1] * radius + (hash(seed * 13.3) - 0.5) * jitter;
        positions[i * 3 + 2] = direction[2] * radius + (hash(seed * 14.7) - 0.5) * jitter;

        const towardCentre = Math.max(0, dot(direction, CENTRE_DIRECTION));

        // Cubed: broad drifts are the minority they are in real cloud,
        // with fine structure filling everything between them.
        const scale = hash(seed * 5.1);
        sizes[i] = radius * (0.035 + scale * scale * scale * 0.3);
        // Faint everywhere, and fainter the bigger the puff — the glow
        // only works as an accumulation of many overlapping layers, never
        // as any single one of them being visible.
        opacities[i] = (0.012 + hash(seed * 6.7) * 0.03) * (1 - scale * 0.55) * (0.5 + towardCentre * 1.2);
        warmth[i] = Math.min(1, towardCentre * 1.3 + hash(seed * 9.1) * 0.25);
    }

    return { positions, sizes, opacities, warmth };
}

/**
 * The dust: dark, irregular clouds sitting between the viewer and the
 * glow, so they block it rather than being painted over it. That's the
 * difference between real dust lanes and dark stripes — and it's why
 * these are placed at a smaller radius than the glow above.
 *
 * Concentrated harder along the plane's midline than anything else here:
 * the dust in the galaxy really is a thin layer inside an already thin
 * disk, which is what makes the great rift down the band look the way it
 * does.
 */
export function buildDustLanes(count: number, minRadius: number, maxRadius: number): CloudPoints {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const warmth = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const seed = i * 4.13 + 67;

        // Sample around the plane, then pull hard toward its midline.
        let direction = galacticDirection(seed);
        const drift = dot(direction, PLANE_NORMAL);
        direction = normalize([
            direction[0] - PLANE_NORMAL[0] * drift * 0.85,
            direction[1] - PLANE_NORMAL[1] * drift * 0.85,
            direction[2] - PLANE_NORMAL[2] * drift * 0.85,
        ]);

        const radius = minRadius + hash(seed * 2.3) * (maxRadius - minRadius);
        positions[i * 3] = direction[0] * radius;
        positions[i * 3 + 1] = direction[1] * radius;
        positions[i * 3 + 2] = direction[2] * radius;

        const towardCentre = Math.max(0, dot(direction, CENTRE_DIRECTION));
        // Same treatment as the glow: many small clouds rather than a
        // few large ones, so the lanes come out ragged and branching
        // instead of as dark blobs laid over the band.
        const scale = hash(seed * 7.9);
        sizes[i] = radius * (0.03 + scale * scale * scale * 0.26);
        opacities[i] = (0.05 + hash(seed * 5.7) * 0.22) * (1 - scale * 0.4) * (0.6 + towardCentre * 0.9);
        warmth[i] = hash(seed * 11.3);
    }

    return { positions, sizes, opacities, warmth };
}
