import { CanvasTexture } from "three";

let cached: CanvasTexture | null = null;

/**
 * A small soft circular sprite (white center, fading to transparent
 * edge) for use as a Points material's `map`. Without this, WebGL point
 * sprites render as plain hard-edged squares — this makes them read as
 * soft little balls instead of pixelated dots.
 *
 * Cached module-wide (not per-component) since every dot everywhere in
 * the scene can share the exact same texture.
 */
export function getDotTexture(): CanvasTexture {
    if (cached) return cached;

    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.85)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    cached = new CanvasTexture(canvas);
    cached.needsUpdate = true;
    return cached;
}

let cachedHaze: CanvasTexture | null = null;

// Deterministic hash (not Math.random — module-load-time canvas
// generation should stay reproducible like everything else here).
function hazeHash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * A soft, IRREGULAR sprite for the ambient "space smoke" layer — several
 * overlapping soft blobs at randomized offsets/sizes, composited
 * together, rather than one perfect radial gradient. A single clean
 * circle read as "a glow bubble," not smoke — real smoke/haze has an
 * uneven, wispy silhouette, which is what layering asymmetric blobs
 * approximates. Not used for individual neuron/particle dots (those use
 * getDotTexture's crisp small sprite instead).
 */
export function getHazeTexture(): CanvasTexture {
    if (cachedHaze) return cachedHaze;

    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cx = size / 2, cy = size / 2;

    ctx.globalCompositeOperation = "lighter";
    const BLOBS = 7;
    for (let i = 0; i < BLOBS; i++) {
        // Offsets stay within the middle portion of the canvas so the
        // overall silhouette is still roughly sprite-shaped (doesn't
        // clip at the edges) while each individual blob's center is
        // irregularly placed.
        const angle = hazeHash(i * 3.1) * Math.PI * 2;
        const dist = hazeHash(i * 5.7) * size * 0.22;
        const bx = cx + Math.cos(angle) * dist;
        const by = cy + Math.sin(angle) * dist;
        const radius = size * (0.22 + hazeHash(i * 7.3) * 0.2);

        // Kept deliberately low even at each blob's own center — with 7
        // overlapping blobs composited via "lighter", anything much
        // higher stacked up into a solid opaque core (reading as a hot
        // lamp/bubble instead of misty smoke) well before it even
        // reached the per-sprite material opacity in the scene.
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
        grad.addColorStop(0, "rgba(255,255,255,0.22)");
        grad.addColorStop(0.5, "rgba(255,255,255,0.09)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
    }

    cachedHaze = new CanvasTexture(canvas);
    cachedHaze.needsUpdate = true;
    return cachedHaze;
}
