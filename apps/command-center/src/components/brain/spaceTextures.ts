import { CanvasTexture } from "three";

/**
 * Procedurally drawn textures for the deep-space environment around the
 * brain (see SpaceBackdrop). Canvas rather than image files: nothing to
 * source or ship, and a galaxy built out of its own star population can
 * be tuned — arm pitch, dust lanes, core size — instead of being a
 * fixed picture.
 *
 * Everything here is deterministic (a hash, not Math.random) so the sky
 * is the same on every load rather than reshuffling between sessions.
 */

function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

let cachedStar: CanvasTexture | null = null;

/**
 * A single star: a tight bright core with a small soft halo. Deliberately
 * NOT a big soft blob — stars are point sources, and the moment they get
 * wide they read as glowing particles instead.
 */
export function getStarTexture(): CanvasTexture {
    if (cachedStar) return cachedStar;

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const center = size / 2;

    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.12, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.22)");
    gradient.addColorStop(0.65, "rgba(255,255,255,0.05)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    cachedStar = new CanvasTexture(canvas);
    cachedStar.needsUpdate = true;
    return cachedStar;
}

const cachedGalaxyDiscs = new Map<number, CanvasTexture>();

// Log spiral: r = A * e^(B * theta). B controls how tightly the arms
// wind — Andromeda's are tight, which is what keeps it reading as a real
// galaxy rather than a pinwheel.
const ARM_TIGHTNESS = 0.22;
const ARM_COUNT = 2;
// Stars drawn per arm, plus the diffuse population between them.
const ARM_STARS = 26000;
const HALO_STARS = 9000;

/**
 * A galaxy disc, drawn as an actual population of stars.
 *
 * NOT currently rendered: both the Milky Way band and Andromeda were
 * removed from the scene on request, leaving the star field and the
 * distant-galaxy smudges as everything beyond the Solar System. Kept
 * because it's the hard part — a galaxy built out of its own arms, dust
 * lanes and inclination — and putting one back is then a two-line
 * change.
 *
 * Built the way the real thing is put together, because that's what
 * makes it read as astronomy rather than as a painted swirl:
 *   - a small, bright, WARM core (old stars) inside a broad dim bulge
 *   - two tightly wound spiral arms of cooler blue-white stars, with
 *     brighter knots where star formation clusters
 *   - dark dust lanes carved along the inside edge of each arm
 *   - the whole disc squashed vertically: Andromeda is seen at a steep
 *     inclination, nearly edge-on, which is most of its silhouette
 *
 * The texture is drawn face-on and squashed here rather than tilted in
 * 3D, so the galaxy stays a flat plane in the scene and never catches
 * the eye as a rotating billboard.
 */
export function getGalaxyDiscTexture(flatten: number): CanvasTexture {
    const cached = cachedGalaxyDiscs.get(flatten);
    if (cached) return cached;

    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cx = size / 2;
    const cy = size / 2;

    // How far the disc is squashed vertically — the inclination it's
    // seen at, and the single most important number here. Passed in,
    // because the same generator draws two very different views:
    //
    //   - the Milky Way at ~0.05: we are INSIDE its disc, so it can only
    //     be seen edge-on, as a long faint band across the sky;
    //   - Andromeda at ~0.3: another galaxy entirely, seen from far
    //     outside and tilted, so it reads as an elongated oval with a
    //     bright middle — which is exactly how M31 looks from here.
    const FLATTEN = flatten;
    const discRadius = size * 0.46;

    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = "lighter";

    // --- diffuse disc glow ------------------------------------------
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, FLATTEN);
    const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, discRadius);
    disc.addColorStop(0, "rgba(255,238,214,0.5)");
    disc.addColorStop(0.12, "rgba(240,226,206,0.28)");
    disc.addColorStop(0.4, "rgba(196,206,226,0.12)");
    disc.addColorStop(0.75, "rgba(150,168,200,0.045)");
    disc.addColorStop(1, "rgba(120,140,180,0)");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- the core ----------------------------------------------------
    ctx.save();
    ctx.translate(cx, cy);
    // The bulge stands a little proud of the disc, as it does in the
    // real thing — the one part of an edge-on galaxy that isn't flat.
    // The bulge is the one part of the galaxy that isn't flat, so it
    // keeps far more of its height than the disc around it.
    ctx.scale(1, FLATTEN * 5.5);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.075);
    core.addColorStop(0, "rgba(255,247,232,0.95)");
    core.addColorStop(0.25, "rgba(255,232,198,0.6)");
    core.addColorStop(0.6, "rgba(238,206,166,0.2)");
    core.addColorStop(1, "rgba(210,180,150,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- spiral arms, star by star -----------------------------------
    const plot = (x: number, y: number, radius: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(cx + x, cy + y * FLATTEN, radius, radius);
    };

    for (let arm = 0; arm < ARM_COUNT; arm++) {
        const armOffset = (arm / ARM_COUNT) * Math.PI * 2;
        for (let i = 0; i < ARM_STARS; i++) {
            const seed = arm * 7919 + i;
            // Distance along the arm, biased outward a little so the
            // inner disc doesn't turn into a solid mass.
            const t = Math.pow(hash(seed * 1.7), 0.62);
            const theta = armOffset + t * Math.PI * 4.2;
            const radius = size * 0.055 * Math.exp(ARM_TIGHTNESS * t * Math.PI * 4.2);
            if (radius > discRadius) continue;

            // Scatter across the arm's width, wider further out — real
            // arms fray at the edges rather than staying ribbons.
            const spread = (hash(seed * 3.1) - 0.5) * size * (0.02 + t * 0.075);
            const spreadAngle = (hash(seed * 5.3) - 0.5) * 0.5;
            const x = Math.cos(theta + spreadAngle) * radius + spread;
            const y = Math.sin(theta + spreadAngle) * radius + spread * 0.6;

            // Cooler blue-white in the arms, with occasional brighter
            // knots where clusters sit.
            const knot = hash(seed * 9.7) > 0.994;
            const brightness = knot ? 0.55 : 0.05 + hash(seed * 2.3) * 0.13;
            const blue = 210 + Math.floor(hash(seed * 4.4) * 45);
            plot(x, y, knot ? 2 : 1, `rgba(${205 + Math.floor(hash(seed * 6.1) * 30)},${218},${blue},${brightness})`);
        }
    }

    // --- halo / field population -------------------------------------
    for (let i = 0; i < HALO_STARS; i++) {
        const seed = 104729 + i;
        const angle = hash(seed) * Math.PI * 2;
        const radius = Math.pow(hash(seed * 1.3), 0.5) * discRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const warm = radius < discRadius * 0.3;
        const brightness = 0.03 + hash(seed * 2.9) * 0.07;
        plot(x, y, 1, warm
            ? `rgba(255,236,208,${brightness})`
            : `rgba(214,224,242,${brightness})`);
    }

    // --- dust lanes ---------------------------------------------------
    // Carved out of what's already drawn rather than painted on top:
    // dust blocks the light behind it, and subtracting is the only way
    // that reads correctly against the disc's own glow.
    ctx.globalCompositeOperation = "destination-out";

    // Seen this close to edge-on, the near side's dust is a dark lane
    // running the length of the disc — the defining feature of every
    // edge-on galaxy photograph.
    ctx.save();
    ctx.translate(cx, cy + size * 0.022);
    ctx.filter = "blur(7px)";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 0, discRadius * 0.95, size * 0.006, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    for (let arm = 0; arm < ARM_COUNT; arm++) {
        const armOffset = (arm / ARM_COUNT) * Math.PI * 2 - 0.22;
        ctx.beginPath();
        for (let step = 0; step <= 120; step++) {
            const t = step / 120;
            const theta = armOffset + t * Math.PI * 4.2;
            const radius = size * 0.062 * Math.exp(ARM_TIGHTNESS * t * Math.PI * 4.2);
            const x = cx + Math.cos(theta) * radius;
            const y = cy + Math.sin(theta) * radius * FLATTEN;
            if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = size * 0.022;
        ctx.filter = "blur(6px)";
        ctx.stroke();
        ctx.filter = "none";
    }

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    cachedGalaxyDiscs.set(flatten, texture);
    return texture;
}

const cachedGalaxies: (CanvasTexture | null)[] = [];

/**
 * A far-off galaxy: an unresolved elliptical smudge, a few pixels of
 * structure at most. Anything more detailed at this distance would be
 * wrong — that's the whole point of them being distant.
 */
export function getDistantGalaxyTexture(variant: number): CanvasTexture {
    const cached = cachedGalaxies[variant];
    if (cached) return cached;

    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const center = size / 2;
    const flatten = 0.35 + hash(variant * 3.7) * 0.5;
    const tilt = hash(variant * 5.1) * Math.PI;

    ctx.translate(center, center);
    ctx.rotate(tilt);
    ctx.scale(1, flatten);

    const warm = hash(variant * 7.3) > 0.5;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, center);
    gradient.addColorStop(0, warm ? "rgba(255,240,220,0.75)" : "rgba(226,234,255,0.7)");
    gradient.addColorStop(0.25, warm ? "rgba(240,220,196,0.28)" : "rgba(200,214,244,0.26)");
    gradient.addColorStop(0.6, "rgba(170,186,215,0.07)");
    gradient.addColorStop(1, "rgba(140,160,200,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, center, 0, Math.PI * 2);
    ctx.fill();

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    cachedGalaxies[variant] = texture;
    return texture;
}

let cachedGlare: CanvasTexture | null = null;

/**
 * The Sun's glare: a small, tight halo around the stellar disc — the
 * scattering any real lens shows, not a corona and not a lens flare.
 */
export function getSunGlareTexture(): CanvasTexture {
    if (cachedGlare) return cachedGlare;

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const center = size / 2;

    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, "rgba(255,250,240,0.5)");
    gradient.addColorStop(0.06, "rgba(255,244,224,0.28)");
    gradient.addColorStop(0.18, "rgba(255,236,206,0.08)");
    gradient.addColorStop(0.45, "rgba(255,232,200,0.02)");
    gradient.addColorStop(1, "rgba(255,230,200,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    cachedGlare = new CanvasTexture(canvas);
    cachedGlare.needsUpdate = true;
    return cachedGlare;
}

let cachedMoon: CanvasTexture | null = null;

/**
 * The Moon: grey, airless, and covered in craters at every scale.
 *
 * Drawn as a real surface rather than a texture pattern — dark basalt
 * maria as broad irregular patches over lighter highlands, then craters
 * of many sizes with bright rims and shadowed floors, then a couple of
 * young craters with ray systems (Tycho's rays reach a third of the way
 * around the Moon). No haze pass at the end, unlike a world with an
 * atmosphere: lunar features stay sharp right to the limb.
 */
export function getMoonTexture(): CanvasTexture {
    if (cachedMoon) return cachedMoon;

    const width = 1024;
    const height = 512;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    // Highlands: light grey, faintly warm.
    ctx.fillStyle = "#9a978f";
    ctx.fillRect(0, 0, width, height);

    // Broad brightness variation, so the disc isn't uniform.
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 320; i++) {
        const seed = i * 4.7 + 1;
        ctx.fillStyle = hash(seed) > 0.5 ? "#b4b1a9" : "#7f7d77";
        ctx.beginPath();
        ctx.arc(hash(seed * 1.7) * width, hash(seed * 2.9) * height, 20 + hash(seed * 3.3) * 90, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Maria: the dark basalt plains, in rough irregular groups rather
    // than clean circles.
    const maria: [number, number, number, number][] = [
        [0.30, 0.30, 0.11, 0.14], [0.38, 0.24, 0.07, 0.09], [0.24, 0.42, 0.08, 0.10],
        [0.44, 0.40, 0.06, 0.07], [0.19, 0.30, 0.05, 0.07], [0.34, 0.46, 0.05, 0.05],
        [0.72, 0.36, 0.05, 0.06], [0.80, 0.52, 0.04, 0.05],
    ];
    maria.forEach(([x, y, rx, ry], index) => {
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = index % 2 === 0 ? "#5f5e5c" : "#67655f";
        ctx.beginPath();
        ctx.ellipse(width * x, height * y, width * rx, height * ry, hash(index * 5.1) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        // Ragged edges, so the seas don't read as painted ovals.
        for (let i = 0; i < 26; i++) {
            const seed = index * 31 + i;
            const angle = hash(seed) * Math.PI * 2;
            const px = width * x + Math.cos(angle) * width * rx * (0.8 + hash(seed * 1.3) * 0.5);
            const py = height * y + Math.sin(angle) * height * ry * (0.8 + hash(seed * 1.9) * 0.5);
            ctx.beginPath();
            ctx.arc(px, py, width * (0.008 + hash(seed * 2.7) * 0.02), 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;

    // Craters, small to large.
    for (let i = 0; i < 1400; i++) {
        const seed = i * 9.13 + 7;
        const x = hash(seed) * width;
        const y = hash(seed * 1.7) * height;
        const radius = 1.5 + Math.pow(hash(seed * 2.3), 3.4) * 46;

        // Bright rim...
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#c3bfb6";
        ctx.lineWidth = Math.max(0.6, radius * 0.16);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // ...darker floor, offset a touch so the light direction in the
        // texture is consistent.
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#6f6d67";
        ctx.beginPath();
        ctx.arc(x + radius * 0.1, y + radius * 0.1, radius * 0.86, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ray systems from a couple of young craters.
    [[0.46, 0.74], [0.66, 0.22]].forEach(([cx, cy], index) => {
        const originX = width * cx;
        const originY = height * cy;
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = "#d3cfc6";
        for (let i = 0; i < 60; i++) {
            const seed = index * 97 + i;
            const angle = hash(seed) * Math.PI * 2;
            const length = width * (0.05 + hash(seed * 1.7) * 0.22);
            ctx.lineWidth = 1 + hash(seed * 2.3) * 3;
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(originX + Math.cos(angle) * length, originY + Math.sin(angle) * length * 0.6);
            ctx.stroke();
        }
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#c9c5bc";
        ctx.beginPath();
        ctx.arc(originX, originY, width * 0.012, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    cachedMoon = new CanvasTexture(canvas);
    cachedMoon.needsUpdate = true;
    return cachedMoon;
}

let cachedEarth: CanvasTexture | null = null;

/**
 * Earth: deep blue oceans, land in muted greens and browns, polar ice,
 * and a layer of white cloud over the lot.
 *
 * The continents are approximations of the real ones rather than a
 * traced map — enough for the planet to read as Earth at the size it
 * appears here, where it's a few hundred pixels across at most.
 */
export function getEarthTexture(): CanvasTexture {
    if (cachedEarth) return cachedEarth;

    const width = 1024;
    const height = 512;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    // Ocean, deeper toward the middle latitudes.
    const ocean = ctx.createLinearGradient(0, 0, 0, height);
    ocean.addColorStop(0, "#123a58");
    ocean.addColorStop(0.5, "#0d2f52");
    ocean.addColorStop(1, "#123a58");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, width, height);

    // Landmasses, as clusters of blobs at roughly the right places on an
    // equirectangular map (x = longitude, y = latitude).
    const land: [number, number, number, number][] = [
        // Africa + Europe
        [0.55, 0.52, 0.06, 0.13], [0.53, 0.40, 0.05, 0.07], [0.52, 0.33, 0.05, 0.04],
        // Asia
        [0.66, 0.32, 0.13, 0.10], [0.72, 0.42, 0.06, 0.06], [0.78, 0.5, 0.03, 0.04],
        // North America
        [0.22, 0.30, 0.09, 0.10], [0.25, 0.42, 0.03, 0.05],
        // South America
        [0.30, 0.60, 0.05, 0.11],
        // Australia
        [0.82, 0.66, 0.05, 0.05],
    ];
    land.forEach(([x, y, rx, ry], index) => {
        const green = hash(index * 3.7) > 0.45;
        ctx.fillStyle = green ? "#3d5637" : "#6b5c3f";
        ctx.beginPath();
        ctx.ellipse(width * x, height * y, width * rx, height * ry, hash(index * 5.3) * Math.PI, 0, Math.PI * 2);
        ctx.fill();

        // Broken coastlines.
        for (let i = 0; i < 40; i++) {
            const seed = index * 61 + i;
            const angle = hash(seed) * Math.PI * 2;
            const px = width * x + Math.cos(angle) * width * rx * (0.75 + hash(seed * 1.3) * 0.6);
            const py = height * y + Math.sin(angle) * height * ry * (0.75 + hash(seed * 1.9) * 0.6);
            ctx.fillStyle = hash(seed * 2.7) > 0.5 ? "#40593a" : "#705f42";
            ctx.beginPath();
            ctx.arc(px, py, width * (0.004 + hash(seed * 3.1) * 0.014), 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Arid regions, so the land isn't uniformly green.
    ctx.globalAlpha = 0.5;
    [[0.55, 0.42, 0.06, 0.04], [0.7, 0.38, 0.05, 0.03], [0.83, 0.66, 0.03, 0.03]].forEach(([x, y, rx, ry]) => {
        ctx.fillStyle = "#8a7550";
        ctx.beginPath();
        ctx.ellipse(width * x, height * y, width * rx, height * ry, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Polar ice.
    ["#dfe6ea", "#e6ecf0"].forEach((color, index) => {
        const gradient = ctx.createLinearGradient(0, index === 0 ? 0 : height, 0, index === 0 ? height * 0.14 : height * 0.86);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(223,230,234,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, index === 0 ? 0 : height * 0.86, width, height * 0.14);
    });

    // Cloud systems: banded the way the real circulation puts them —
    // heavy at the equator and mid-latitudes, thin over the subtropics.
    const clouds = document.createElement("canvas");
    clouds.width = width;
    clouds.height = height;
    const cloudCtx = clouds.getContext("2d")!;
    for (let i = 0; i < 2200; i++) {
        const seed = i * 7.7 + 13;
        const y = hash(seed * 1.9) * height;
        const latitude = Math.abs(y / height - 0.5) * 2;
        const band = Math.exp(-Math.pow((latitude - 0.05) / 0.18, 2)) + Math.exp(-Math.pow((latitude - 0.62) / 0.22, 2)) * 0.9;
        if (hash(seed * 2.3) > band * 0.8) continue;

        cloudCtx.globalAlpha = 0.05 + hash(seed * 3.1) * 0.14;
        cloudCtx.fillStyle = "#ffffff";
        cloudCtx.beginPath();
        cloudCtx.ellipse(
            hash(seed) * width, y,
            width * (0.006 + hash(seed * 4.3) * 0.05),
            height * (0.004 + hash(seed * 5.9) * 0.018),
            hash(seed * 6.7) * Math.PI, 0, Math.PI * 2,
        );
        cloudCtx.fill();
    }
    ctx.globalAlpha = 0.95;
    ctx.filter = "blur(2px)";
    ctx.drawImage(clouds, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    cachedEarth = new CanvasTexture(canvas);
    cachedEarth.needsUpdate = true;
    return cachedEarth;
}

const cachedPlanets = new Map<string, CanvasTexture>();

export interface PlanetPalette {
    /** Base disc colour. */
    base: string;
    /** Slightly lighter and darker band colours. */
    light: string;
    dark: string;
    /** How strongly the latitude banding shows (gas giants: strong). */
    banding: number;
    /** How much blotchy surface detail shows (rocky worlds). */
    mottle: number;
}

/**
 * A planet's disc: latitude bands over a base colour, plus mottling.
 *
 * One generator for all of them rather than a texture each, because at
 * the sizes these appear — a few dozen pixels for the giants, a couple
 * for Mercury — banding, tone and colour are the entire visible story.
 * The differences that matter between worlds live in the palette.
 */
export function getPlanetTexture(id: string, palette: PlanetPalette): CanvasTexture {
    const cached = cachedPlanets.get(id);
    if (cached) return cached;

    const width = 512;
    const height = 256;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, width, height);

    // Latitude bands.
    for (let y = 0; y < height; y++) {
        const latitude = y / height;
        const wave = Math.sin(latitude * Math.PI * 9) * 0.6 + Math.sin(latitude * Math.PI * 21 + 1.3) * 0.4;
        ctx.globalAlpha = Math.abs(wave) * palette.banding;
        ctx.fillStyle = wave > 0 ? palette.light : palette.dark;
        ctx.fillRect(0, y, width, 1);
    }

    // Mottling: storms on the giants, terrain on the rocky worlds.
    ctx.globalAlpha = palette.mottle;
    for (let i = 0; i < 260; i++) {
        const seed = i * 5.9 + 1;
        ctx.fillStyle = hash(seed) > 0.5 ? palette.light : palette.dark;
        ctx.beginPath();
        ctx.ellipse(
            hash(seed * 1.7) * width,
            hash(seed * 2.3) * height,
            width * (0.01 + hash(seed * 3.1) * 0.05),
            height * (0.006 + hash(seed * 4.3) * 0.02),
            0, 0, Math.PI * 2,
        );
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    const softened = document.createElement("canvas");
    softened.width = width;
    softened.height = height;
    const softCtx = softened.getContext("2d")!;
    softCtx.filter = "blur(3px)";
    softCtx.drawImage(canvas, 0, 0);

    const texture = new CanvasTexture(softened);
    texture.needsUpdate = true;
    cachedPlanets.set(id, texture);
    return texture;
}

let cachedRings: CanvasTexture | null = null;

/**
 * Saturn's rings, as a strip sampled radially: bright inner B ring, the
 * Cassini division as a dark gap, then the fainter A ring. Drawn once
 * and mapped across a ring geometry.
 */
export function getRingTexture(): CanvasTexture {
    if (cachedRings) return cachedRings;

    const width = 512;
    const height = 8;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    // Bands across the strip: value is opacity, colour a pale sand.
    // The real ring system, inner edge to outer: the faint C ring, the
    // dense B ring, the Cassini division as a near-empty gap, the A ring
    // with the Encke gap cut into it, and then nothing.
    const bands: [number, number, number][] = [
        // [start, end, opacity]
        [0.0, 0.04, 0], [0.04, 0.2, 0.14], [0.2, 0.34, 0.4],
        [0.34, 0.54, 0.52], [0.54, 0.6, 0.34], [0.6, 0.66, 0.04],
        [0.66, 0.86, 0.3], [0.86, 0.89, 0.05], [0.89, 0.96, 0.22],
        [0.96, 1, 0],
    ];
    bands.forEach(([start, end, alpha]) => {
        ctx.fillStyle = `rgba(226,213,186,${alpha})`;
        ctx.fillRect(width * start, 0, width * (end - start), height);
    });

    // Fine structure, so the rings aren't flat blocks.
    for (let i = 0; i < 320; i++) {
        const seed = i * 3.7 + 5;
        const x = hash(seed) * width;
        ctx.fillStyle = `rgba(228,216,190,${hash(seed * 1.9) * 0.09})`;
        ctx.fillRect(x, 0, 1 + hash(seed * 2.7) * 3, height);
    }

    cachedRings = new CanvasTexture(canvas);
    cachedRings.needsUpdate = true;
    return cachedRings;
}
