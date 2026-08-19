/**
 * What's outside the Laboratory: the Moon's surface, and Earth above it.
 *
 * This is ONLY the environment behind the room. It draws no part of the
 * Laboratory itself — no glass, no frame, no interior, nothing of the
 * interface that sits on top of it. The room is already built; this is
 * the view it looks out on.
 *
 * Drawn rather than photographed, for the same reason the rest of this
 * app's space is drawn (see brain/spaceTextures.ts): a background that
 * fills a 4K screen is a multi-megabyte asset to source, license and
 * ship, and this one renders once and is kept. It also lets the scene
 * match the flight that arrives here — the camera leaves the brain and
 * closes on the Moon (see BrainScene3D's departure), and this is where
 * it lands.
 *
 * What makes it read as the Moon rather than as grey desert, and what
 * every choice below is answering to:
 *
 *   - No air. So the sky is BLACK down to the horizon with no gradient
 *     whatsoever, the terrain meets space along a hard edge, distant
 *     mountains are as sharp as near rocks (no haze to soften them),
 *     and every shadow is black — nothing scatters light into one.
 *   - The sun is low and to one side. Every lit face points at it and
 *     every shadow runs the other way, long and hard-edged.
 *   - The horizon is CLOSE and visibly curved: from standing height on
 *     the Moon it's about 2.4 km away, a third of Earth's.
 *   - Earth hangs still, and it is SMALL — about two degrees across,
 *     four times the Moon as seen from home but nothing like the
 *     dinner plate it's usually drawn as. It doesn't rise or set from
 *     any one spot on the surface.
 *
 * Composition is aimed at the room in front of it: the interface fills
 * the middle of the screen, so Earth, the outpost and the mountains sit
 * out where they can actually be seen rather than behind a panel.
 */

const WIDTH = 3840;
const HEIGHT = 2160;

// Where the ground starts, and how much the horizon bows.
//
// High in the frame, and that's composition rather than geography: the
// Laboratory's own panels fill the middle of the screen from about a
// third of the way down, so a horizon at the halfway mark — with the
// mountains and the outpost standing on it — would sit entirely behind
// them. Up here the distant landscape lands in the open strip between
// the top bar and the first row of cards, and everything below is
// foreground, which is exactly what shows around and beneath them.
const HORIZON_Y = HEIGHT * 0.26;
const HORIZON_BOW = HEIGHT * 0.028;

// The sun sits low and off to the left, out of frame. Everything lit is
// lit from there; every shadow falls the other way.
const SHADOW = 1;

let cached: string | null = null;

// Deterministic (a hash, not Math.random): the same surface every time
// the Laboratory opens, rather than a different one per session.
function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

/** Value noise with smooth interpolation — the mottling of regolith. */
function valueNoise(x: number, y: number, seed: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const corner = (cx: number, cy: number) => hash(cx * 374.761 + cy * 668.265 + seed * 91.7);

    const top = corner(xi, yi) + (corner(xi + 1, yi) - corner(xi, yi)) * smooth(xf);
    const bottom = corner(xi, yi + 1) + (corner(xi + 1, yi + 1) - corner(xi, yi + 1)) * smooth(xf);
    return top + (bottom - top) * smooth(yf);
}

function fractalNoise(x: number, y: number, seed: number, octaves = 4): number {
    let value = 0, amplitude = 0.5, frequency = 1, total = 0;
    for (let i = 0; i < octaves; i++) {
        value += valueNoise(x * frequency, y * frequency, seed + i * 17) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return value / total;
}

/** How far down the ground a point is: 0 at the horizon, 1 at your feet. */
function depthAt(y: number): number {
    return Math.min(1, Math.max(0, (y - HORIZON_Y) / (HEIGHT - HORIZON_Y)));
}

/** The bowed horizon's height at a given x. */
function horizonAt(x: number): number {
    const t = x / WIDTH;
    return HORIZON_Y + HORIZON_BOW * (4 * (t - 0.5) ** 2 - 1) + HORIZON_BOW;
}

function drawSky(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stars, kept deliberately faint: on a sunlit surface the ground is
    // orders of magnitude brighter, and a sky full of blazing stars is
    // the single most common tell of a painted space scene rather than
    // a photographed one.
    for (let i = 0; i < 1100; i++) {
        const x = hash(i * 1.7) * WIDTH;
        const y = hash(i * 3.1 + 5) * HORIZON_Y;
        const magnitude = Math.pow(hash(i * 5.3 + 2), 3.6);
        const radius = 0.6 + magnitude * 1.9;
        const alpha = 0.1 + magnitude * 0.5;

        const temperature = hash(i * 9.1 + 7);
        const tint = temperature > 0.88 ? "196, 212, 255" : temperature < 0.1 ? "255, 232, 208" : "255, 255, 255";

        ctx.fillStyle = `rgba(${tint}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // The Milky Way: a band of unresolved light, NOT a spiral seen from
    // outside — the observer is inside it. Faint enough to read as sky
    // rather than as decoration.
    ctx.save();
    ctx.translate(WIDTH * 0.2, HORIZON_Y * 0.3);
    ctx.rotate(-0.4);
    for (let i = 0; i < 300; i++) {
        const along = (hash(i * 2.9 + 31) - 0.5) * WIDTH * 1.4;
        const across = (hash(i * 4.7 + 13) - 0.5) * HEIGHT * 0.13;
        const size = 90 + hash(i * 6.1 + 3) * 300;
        const glow = ctx.createRadialGradient(along, across, 0, along, across, size);
        glow.addColorStop(0, `rgba(198, 206, 226, ${0.01 + hash(i * 8.3) * 0.014})`);
        glow.addColorStop(1, "rgba(198, 206, 226, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(along, across, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawEarth(ctx: CanvasRenderingContext2D) {
    // Off to one side and well above the horizon, in the strip of sky
    // the interface leaves open. Small: Earth is about two degrees
    // across from here, and at this frame's field of view that lands
    // near this radius. It reads as a real object at a real distance
    // exactly BECAUSE it isn't filling the sky.
    const cx = WIDTH * 0.315;
    const cy = HEIGHT * 0.125;
    const r = 92;

    // Atmosphere, seen edge-on: a hairline of scattered light against
    // the limb, not a glow around a ball. There's nothing between here
    // and there to spread it out.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.12);
    halo.addColorStop(0, "rgba(128, 176, 240, 0.5)");
    halo.addColorStop(1, "rgba(96, 148, 220, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Saturated, because at this size everything on the disc averages
    // together on screen — a "realistic" muted blue reads as grey and
    // turns Earth into another moon.
    const ocean = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ocean.addColorStop(0, "#3f8fe0");
    ocean.addColorStop(0.5, "#1f5cb4");
    ocean.addColorStop(1, "#0e3573");
    ctx.fillStyle = ocean;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Land as thresholded noise rather than as drawn coastlines: at
    // this size real ones would be a lie either way, and noise at least
    // has the right kind of edge.
    const step = 2;
    for (let y = cy - r; y < cy + r; y += step) {
        for (let x = cx - r; x < cx + r; x += step) {
            const n = fractalNoise((x - cx) / 17, (y - cy) / 17, 3.1, 4);
            if (n < 0.53) continue;
            const green = n > 0.61;
            ctx.fillStyle = green
                ? `rgba(${62 + Math.floor(n * 30)}, ${122 + Math.floor(n * 52)}, 58, 0.95)`
                : `rgba(${158 + Math.floor(n * 48)}, ${132 + Math.floor(n * 30)}, 84, 0.92)`;
            ctx.fillRect(x, y, step + 1, step + 1);
        }
    }

    // Weather systems — white, and not many.
    for (let i = 0; i < 60; i++) {
        const angle = hash(i * 3.3 + 19) * Math.PI * 2;
        const distance = Math.sqrt(hash(i * 5.9 + 4)) * r;
        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance * 0.9;
        const size = 6 + hash(i * 7.7 + 9) * 20;
        const cloud = ctx.createRadialGradient(x, y, 0, x, y, size);
        cloud.addColorStop(0, `rgba(255, 255, 255, ${0.28 + hash(i * 2.1) * 0.4})`);
        cloud.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = cloud;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // The terminator: the same sun that lights the ground here lights
    // Earth from the same side, so the far limb falls away into black.
    const terminator = ctx.createLinearGradient(cx - r * 0.2, cy, cx + r, cy);
    terminator.addColorStop(0, "rgba(0, 0, 0, 0)");
    terminator.addColorStop(0.6, "rgba(0, 0, 0, 0.14)");
    terminator.addColorStop(0.88, "rgba(0, 0, 0, 0.72)");
    terminator.addColorStop(1, "rgba(0, 0, 0, 0.94)");
    ctx.fillStyle = terminator;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Curvature: brightest where the sun strikes squarely, falling off
    // towards the edge of the disc.
    const shading = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.34, r * 0.08, cx, cy, r);
    shading.addColorStop(0, "rgba(255, 255, 255, 0.14)");
    shading.addColorStop(0.7, "rgba(255, 255, 255, 0)");
    shading.addColorStop(1, "rgba(0, 0, 0, 0.22)");
    ctx.fillStyle = shading;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.restore();
}

/** The horizon as a closed path over the ground, for clipping. */
function groundPath(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(0, horizonAt(0));
    for (let x = 0; x <= WIDTH; x += 16) ctx.lineTo(x, horizonAt(x));
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.closePath();
}

function drawMountains(ctx: CanvasRenderingContext2D) {
    // Ranges standing ON the horizon. Their edges against space are
    // hard — with no air there is nothing to fade a distant ridge, so
    // the furthest range is exactly as sharp as the nearest rock. Only
    // the LIGHT changes with distance, never the focus.
    const ranges = [
        { height: 210, seed: 21.7, grey: 126, from: -0.05, to: 0.5 },
        { height: 150, seed: 44.3, grey: 102, from: 0.46, to: 1.05 },
        { height: 92, seed: 63.9, grey: 86, from: 0.22, to: 0.9 },
    ];

    ranges.forEach(({ height, seed, grey, from, to }) => {
        const start = WIDTH * from;
        const end = WIDTH * to;

        ctx.beginPath();
        ctx.moveTo(start, horizonAt(start) + 4);
        for (let x = start; x <= end; x += 12) {
            // Squared falloff at both ends so a range settles into the
            // horizon instead of being cut off mid-slope.
            const t = (x - start) / (end - start);
            const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.7;
            const ridge = Math.pow(fractalNoise(x * 0.0022, seed, seed, 4), 1.7);
            ctx.lineTo(x, horizonAt(x) - ridge * height * taper);
        }
        ctx.lineTo(end, horizonAt(end) + 4);
        ctx.closePath();

        const face = ctx.createLinearGradient(0, horizonAt(WIDTH / 2) - height, 0, horizonAt(WIDTH / 2) + 10);
        face.addColorStop(0, `rgb(${grey + 62}, ${grey + 60}, ${grey + 52})`);
        face.addColorStop(0.45, `rgb(${grey}, ${grey - 2}, ${grey - 8})`);
        face.addColorStop(1, `rgb(${grey - 44}, ${grey - 46}, ${grey - 50})`);
        ctx.fillStyle = face;
        ctx.fill();
    });

}

function drawGround(ctx: CanvasRenderingContext2D) {
    ctx.save();
    groundPath(ctx);
    ctx.clip();

    // Brighter at the horizon where the low sun grazes it, darker
    // underfoot where the ground tilts away. Warm neutral grey, which
    // is what regolith actually is — not blue, not brown.
    const base = ctx.createLinearGradient(0, HORIZON_Y - HORIZON_BOW, 0, HEIGHT);
    base.addColorStop(0, "#c8c3b9");
    base.addColorStop(0.14, "#a9a49a");
    base.addColorStop(0.5, "#807b72");
    base.addColorStop(1, "#514e47");
    ctx.fillStyle = base;
    ctx.fillRect(0, HORIZON_Y - HORIZON_BOW - 8, WIDTH, HEIGHT);

    // Mottling, at two scales: broad undulations of the plain, then the
    // fine grain of the dust itself. Coarser with distance, finer
    // underfoot — one surface seen at two ranges.
    const cell = 5;
    for (let y = HORIZON_Y - HORIZON_BOW; y < HEIGHT; y += cell) {
        const depth = depthAt(y);
        const broad = 0.006 + depth * 0.012;
        const fine = 0.05 + depth * 0.13;
        for (let x = 0; x < WIDTH; x += cell) {
            const swell = (fractalNoise(x * broad, y * broad * 2.6, 2.7, 3) - 0.5) * (22 + depth * 26);
            const grain = (fractalNoise(x * fine, y * fine * 2.2, 8.3, 2) - 0.5) * (16 + depth * 40);
            const shade = swell + grain;
            ctx.fillStyle = shade > 0
                ? `rgba(255, 250, 240, ${Math.min(0.42, shade / 105)})`
                : `rgba(12, 10, 8, ${Math.min(0.42, -shade / 105)})`;
            ctx.fillRect(x, y, cell + 1, cell + 1);
        }
    }

    // The strip of plain at the foot of the ranges reads brighter than
    // anything nearer: the low sun grazes it almost edge-on. It's also
    // what keeps the mountains and the ground from merging into one
    // grey mass — with no air, that separation has to come from the
    // light, because it can't come from haze.
    const foot = ctx.createLinearGradient(0, HORIZON_Y - 6, 0, HORIZON_Y + HEIGHT * 0.05);
    foot.addColorStop(0, "rgba(236, 231, 220, 0.6)");
    foot.addColorStop(1, "rgba(236, 231, 220, 0)");
    ctx.fillStyle = foot;
    ctx.fillRect(0, HORIZON_Y - 6, WIDTH, HEIGHT * 0.06);

    ctx.restore();
}

function drawCraters(ctx: CanvasRenderingContext2D) {
    ctx.save();
    groundPath(ctx);
    ctx.clip();

    for (let i = 0; i < 130; i++) {
        // Placed by depth rather than evenly: perspective packs the far
        // ones into the band just under the horizon.
        const depth = Math.pow(hash(i * 2.7 + 1), 2.2);
        const y = HORIZON_Y + depth * (HEIGHT - HORIZON_Y) * 1.05;
        const x = hash(i * 4.3 + 6) * WIDTH * 1.1 - WIDTH * 0.05;
        const size = (12 + hash(i * 6.7 + 2) * 120) * (0.2 + depth * 2);
        // A circle on the ground seen from here is an ellipse, flatter
        // the further off it is.
        const flatten = 0.2 + depth * 0.42;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, flatten);

        // The bowl, lit on the wall facing the sun.
        const bowl = ctx.createRadialGradient(size * SHADOW * 0.34, -size * 0.2, size * 0.04, 0, 0, size);
        bowl.addColorStop(0, "rgba(168, 163, 153, 0.38)");
        bowl.addColorStop(0.5, "rgba(52, 50, 45, 0.38)");
        bowl.addColorStop(1, "rgba(30, 28, 25, 0.2)");
        ctx.fillStyle = bowl;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        // Hard shadow across the far wall — black, because nothing
        // scatters light into a shadow here.
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.93, -Math.PI * 0.44, Math.PI * 0.56);
        ctx.closePath();
        ctx.fillStyle = "rgba(5, 5, 7, 0.5)";
        ctx.fill();

        // The rim, catching the sun on the near side.
        ctx.lineWidth = Math.max(1.5, size * 0.085);
        const rim = ctx.createLinearGradient(-size, 0, size, 0);
        const bright = `rgba(255, 252, 244, ${0.32 + hash(i * 3.9) * 0.24})`;
        rim.addColorStop(0, bright);
        rim.addColorStop(0.5, "rgba(145, 140, 132, 0.22)");
        rim.addColorStop(1, "rgba(28, 26, 23, 0.5)");
        ctx.strokeStyle = rim;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.96, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore();
}

/** Wheel tracks, running out towards the outpost. */
function drawTracks(ctx: CanvasRenderingContext2D) {
    ctx.save();
    groundPath(ctx);
    ctx.clip();

    for (let t = 0; t < 3; t++) {
        const endX = WIDTH * (0.66 + t * 0.012);
        const endY = horizonAt(endX) + 18 + t * 6;
        const startX = WIDTH * (0.34 + t * 0.16);
        const startY = HEIGHT * (0.94 - t * 0.06);

        [-1, 1].forEach((side) => {
            ctx.beginPath();
            ctx.moveTo(startX + side * 26, startY);
            ctx.quadraticCurveTo(
                (startX + endX) / 2 + side * 40, (startY + endY) / 2 + 40,
                endX + side * 2, endY,
            );
            ctx.lineWidth = 7 - t * 1.6;
            // Disturbed regolith is DARKER than the undisturbed surface
            // it sits in — the fine bright dust on top is what gets
            // pushed aside.
            ctx.strokeStyle = "rgba(46, 43, 38, 0.3)";
            ctx.stroke();
        });
    }

    ctx.restore();
}

/**
 * A working research outpost, out towards the horizon.
 *
 * Small on purpose: it's a couple of kilometres off, and the scene is a
 * landscape with a station in it rather than a station with a bit of
 * landscape. Everything here is a shape a real programme would build —
 * pressurised cans, a dome, dishes, arrays, a rover — at plausible
 * proportions to each other.
 */
function drawOutpost(ctx: CanvasRenderingContext2D) {
    const x = WIDTH * 0.665;
    const ground = horizonAt(x) + 30;
    // One unit ≈ one metre at this distance. Everything below is in
    // those, so the parts stay in proportion if the scale changes.
    const u = 4.4;

    const lit = "#d7d3ca";
    const side = "#8e8a82";
    const dark = "#46443e";

    const shadow = (px: number, py: number, w: number, h: number) => {
        ctx.fillStyle = "rgba(6, 6, 8, 0.45)";
        ctx.beginPath();
        ctx.ellipse(px + w * 0.5 * SHADOW, py, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
    };

    ctx.save();

    // Pressurised habitation modules: cylinders lying on the regolith,
    // joined by a tunnel.
    const modules = [
        { dx: -18 * u, w: 15 * u, h: 4.4 * u },
        { dx: 2 * u, w: 12 * u, h: 4.0 * u },
    ];
    modules.forEach(({ dx, w, h }) => {
        shadow(x + dx, ground + h * 0.25, w * 0.62, h * 0.3);

        const body = ctx.createLinearGradient(0, ground - h, 0, ground);
        body.addColorStop(0, lit);
        body.addColorStop(0.45, side);
        body.addColorStop(1, dark);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.roundRect(x + dx - w / 2, ground - h, w, h, h / 2);
        ctx.fill();

        // Ribs, the giveaway that it's a pressure vessel.
        ctx.strokeStyle = "rgba(40, 38, 34, 0.35)";
        ctx.lineWidth = 1;
        for (let r = 1; r < 4; r++) {
            const rx = x + dx - w / 2 + (w * r) / 4;
            ctx.beginPath();
            ctx.moveTo(rx, ground - h + 2);
            ctx.lineTo(rx, ground - 2);
            ctx.stroke();
        }
    });

    // The tunnel between them.
    ctx.fillStyle = side;
    ctx.fillRect(x - 11 * u, ground - 2.2 * u, 9 * u, 1.9 * u);

    // A dome — the one shape that isn't a can.
    shadow(x + 16 * u, ground + u, 6 * u, 1.6 * u);
    const dome = ctx.createLinearGradient(x + 12 * u, ground - 6 * u, x + 20 * u, ground);
    dome.addColorStop(0, lit);
    dome.addColorStop(1, dark);
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.arc(x + 16 * u, ground, 5.2 * u, Math.PI, 0);
    ctx.fill();

    // Solar arrays, angled at a sun that's low in the west.
    [-30, -25].forEach((dx, index) => {
        const px = x + dx * u;
        const py = ground - 5.4 * u - index * 0.6 * u;
        ctx.strokeStyle = side;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px, ground);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.42);
        const panel = ctx.createLinearGradient(-5 * u, 0, 5 * u, 0);
        panel.addColorStop(0, "#3a4356");
        panel.addColorStop(0.5, "#28303f");
        panel.addColorStop(1, "#1b212c");
        ctx.fillStyle = panel;
        ctx.fillRect(-5 * u, -0.7 * u, 10 * u, 1.4 * u);
        ctx.strokeStyle = "rgba(150, 160, 180, 0.3)";
        ctx.lineWidth = 0.6;
        for (let c = 1; c < 6; c++) {
            ctx.beginPath();
            ctx.moveTo(-5 * u + (10 * u * c) / 6, -0.7 * u);
            ctx.lineTo(-5 * u + (10 * u * c) / 6, 0.7 * u);
            ctx.stroke();
        }
        ctx.restore();
    });

    // The big communication dish, pointed at Earth.
    const dishX = x + 27 * u;
    const dishY = ground - 7 * u;
    ctx.strokeStyle = side;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(dishX, ground);
    ctx.lineTo(dishX, dishY);
    ctx.stroke();
    ctx.save();
    ctx.translate(dishX, dishY);
    ctx.rotate(-0.5);
    const dish = ctx.createLinearGradient(-3.4 * u, 0, 3.4 * u, 0);
    dish.addColorStop(0, lit);
    dish.addColorStop(1, "#6f6c65");
    ctx.fillStyle = dish;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4 * u, 1.2 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Antenna masts and a sensor tower.
    [[-34, 9], [10, 7], [22, 11]].forEach(([dx, height]) => {
        const px = x + dx * u;
        ctx.strokeStyle = "rgba(190, 186, 178, 0.85)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(px, ground);
        ctx.lineTo(px, ground - height * u);
        ctx.stroke();
        for (let b = 1; b <= 2; b++) {
            const by = ground - height * u * (b / 2.4);
            ctx.beginPath();
            ctx.moveTo(px - 1.4 * u, by);
            ctx.lineTo(px + 1.4 * u, by);
            ctx.stroke();
        }
    });

    // Equipment and storage on a levelled pad.
    for (let i = 0; i < 5; i++) {
        const px = x + (-8 + i * 3.4) * u;
        const w = 1.8 * u, h = (1.1 + hash(i * 5.5) * 0.9) * u;
        shadow(px, ground + 0.5 * u, w * 0.9, 0.5 * u);
        ctx.fillStyle = i % 2 ? side : lit;
        ctx.fillRect(px - w / 2, ground - h, w, h);
    }

    ctx.restore();
}

/**
 * Exploration vehicles, at three distances.
 *
 * Small, wheeled and on the ground — the scale check for the whole
 * scene. Nothing here hovers or flies.
 */
function drawRovers(ctx: CanvasRenderingContext2D) {
    // Spread through the depth of the scene rather than lined up: one
    // out by the outpost, one crossing the middle distance, one close
    // enough to read as a machine. The near one sits low in the frame,
    // where the foreground actually shows around the interface.
    const rovers = [
        { x: WIDTH * 0.72, scale: 0.9, depth: 0.04 },
        { x: WIDTH * 0.47, scale: 2.2, depth: 0.3 },
        { x: WIDTH * 0.845, scale: 4.4, depth: 0.72 },
    ];

    rovers.forEach(({ x, scale, depth }) => {
        const ground = horizonAt(x) + depth * (HEIGHT - HORIZON_Y);
        const u = 1.7 * scale;

        ctx.save();

        // Shadow first, thrown away from the sun and flattened along
        // the ground.
        ctx.fillStyle = "rgba(6, 6, 8, 0.5)";
        ctx.beginPath();
        ctx.ellipse(x + 3 * u * SHADOW, ground + 0.4 * u, 5.4 * u, 1.1 * u, 0, 0, Math.PI * 2);
        ctx.fill();

        // Chassis: lit on the sun side, dark underneath.
        const body = ctx.createLinearGradient(x - 3 * u, ground - 3 * u, x + 3 * u, ground);
        body.addColorStop(0, "#d9d5cc");
        body.addColorStop(0.6, "#8b877f");
        body.addColorStop(1, "#3f3d38");
        ctx.fillStyle = body;
        ctx.fillRect(x - 3.4 * u, ground - 2.4 * u, 6.8 * u, 1.7 * u);

        // Instrument deck and mast.
        ctx.fillStyle = "#b6b2aa";
        ctx.fillRect(x - 1.4 * u, ground - 3.2 * u, 2.6 * u, 0.9 * u);
        ctx.strokeStyle = "#cbc7bf";
        ctx.lineWidth = Math.max(0.7, 0.35 * u);
        ctx.beginPath();
        ctx.moveTo(x + 1.8 * u, ground - 2.4 * u);
        ctx.lineTo(x + 1.8 * u, ground - 4.6 * u);
        ctx.stroke();
        ctx.fillStyle = "#e2ded5";
        ctx.beginPath();
        ctx.ellipse(x + 1.8 * u, ground - 4.8 * u, 1.1 * u, 0.5 * u, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Wheels.
        ctx.fillStyle = "#2c2a26";
        for (let w = 0; w < 3; w++) {
            ctx.beginPath();
            ctx.ellipse(x - 2.4 * u + w * 2.4 * u, ground - 0.5 * u, 0.9 * u, 0.9 * u, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    });
}

function drawRocks(ctx: CanvasRenderingContext2D) {
    ctx.save();
    groundPath(ctx);
    ctx.clip();

    // Stones and boulders, from grit at the horizon to blocks at your
    // feet. Every one gets a hard shadow: that, more than the colour,
    // is what says there's no air.
    for (let i = 0; i < 900; i++) {
        const depth = Math.pow(hash(i * 3.1 + 21), 1.6);
        const y = HORIZON_Y + depth * (HEIGHT - HORIZON_Y);
        const x = hash(i * 5.7 + 11) * WIDTH;
        const size = (1.4 + hash(i * 7.3 + 5) * 11) * (0.25 + depth * 3.1);

        ctx.fillStyle = "rgba(7, 7, 9, 0.52)";
        ctx.beginPath();
        ctx.ellipse(x + size * 1.7 * SHADOW, y + size * 0.3, size * 2.1, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        const shade = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
        shade.addColorStop(0, "#dcd8ce");
        shade.addColorStop(0.55, "#8d8981");
        shade.addColorStop(1, "#302e2a");
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * (0.62 + hash(i * 2.3) * 0.3), hash(i * 9.1) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawFinish(ctx: CanvasRenderingContext2D) {
    // Glare from the sun off frame on the lit side. Restrained: enough
    // to say where the light is coming from, not a bloom effect.
    const glareX = -WIDTH * 0.04;
    const glare = ctx.createRadialGradient(glareX, HORIZON_Y * 0.94, 0, glareX, HORIZON_Y * 0.94, WIDTH * 0.5);
    glare.addColorStop(0, "rgba(255, 251, 240, 0.22)");
    glare.addColorStop(0.45, "rgba(255, 249, 236, 0.05)");
    glare.addColorStop(1, "rgba(255, 249, 236, 0)");
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Corners down, so the interface over this has somewhere quiet to
    // sit. A photographic falloff, not a dark ring.
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.42, WIDTH / 2, HEIGHT / 2, WIDTH * 0.75);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/**
 * The finished scene as a data URL, drawn once and kept.
 *
 * JPEG rather than PNG: this is a photograph-like image where PNG buys
 * nothing but several times the size, and it never leaves memory anyway.
 */
export function getMoonscapeUrl(): string {
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Order is depth: sky, then everything standing in it, nearest last.
    drawSky(ctx);
    drawEarth(ctx);
    drawMountains(ctx);
    drawGround(ctx);
    drawTracks(ctx);
    drawCraters(ctx);
    drawOutpost(ctx);
    drawRovers(ctx);
    drawRocks(ctx);
    drawFinish(ctx);

    cached = canvas.toDataURL("image/jpeg", 0.9);
    return cached;
}
