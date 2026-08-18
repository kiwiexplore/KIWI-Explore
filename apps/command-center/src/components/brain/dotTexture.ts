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

// One texture per variant (see getHazeTexture) — built once, on demand.
const cachedHaze: (CanvasTexture | null)[] = [];

// Deterministic hash (not Math.random — module-load-time canvas
// generation should stay reproducible like everything else here).
function hazeHash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

/**
 * Value noise on a GRID x GRID lattice, sampled with smooth interpolation
 * — the standard building block for cloud textures. `seed` picks an
 * entirely different field, which is what makes the sprite variants
 * below look like different pieces of cloud rather than the same puff
 * stamped over and over.
 */
function valueNoise(x: number, y: number, grid: number, seed: number): number {
    const gx = Math.floor(x), gy = Math.floor(y);
    const fx = smoothstep(x - gx), fy = smoothstep(y - gy);

    const at = (ix: number, iy: number) => {
        // Wrapped so the lattice tiles: no hard seam anywhere in the
        // sampled area regardless of where the sprite is read from.
        const wx = ((ix % grid) + grid) % grid;
        const wy = ((iy % grid) + grid) % grid;
        return hazeHash(wx * 157.31 + wy * 313.7 + seed * 977.13);
    };

    const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * fx;
    const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * fx;
    return top + (bottom - top) * fy;
}

/**
 * A cloud sprite for the "space smoke" layer: several octaves of value
 * noise (fractal brownian motion) faded out toward the edges, written
 * straight into the alpha channel.
 *
 * This replaced a sprite made of overlapping radial gradients. However
 * many blobs that stacked, each one still had a smooth round falloff, so
 * up close the smoke read as a field of little glowing balls rather than
 * cloud. Noise gives the one thing gradients can't: structure at every
 * scale — wisps and holes inside a single sprite — which is what the eye
 * actually reads as smoke.
 *
 * `variant` picks a different noise field. BrainHaze cycles through them
 * so neighbouring puffs aren't identical stamps of each other, which is
 * the other half of what gave the old version its repetitive, beady look.
 */
export function getHazeTexture(variant = 0): CanvasTexture {
    const cached = cachedHaze[variant];
    if (cached) return cached;

    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const image = ctx.createImageData(size, size);
    const seed = 1 + variant * 7;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Three octaves: broad shape, mid wisps, fine grain.
            const u = x / size, v = y / size;
            let noise = 0;
            noise += valueNoise(u * 3, v * 3, 3, seed) * 0.55;
            noise += valueNoise(u * 6, v * 6, 6, seed + 1) * 0.3;
            noise += valueNoise(u * 12, v * 12, 12, seed + 2) * 0.15;

            // Radial falloff to a hard zero at the sprite's edge — a
            // point sprite is a square, and without this the noise would
            // run right up to that square's border and show it.
            const dx = u - 0.5, dy = v - 0.5;
            const distance = Math.sqrt(dx * dx + dy * dy) * 2;
            const falloff = Math.max(0, 1 - distance);

            // Contrast curve: pushes the low end to nothing so the puff
            // has actual holes and torn edges in it instead of a uniform
            // grey veil. Deliberately capped well below opaque — a sprite
            // with a solid core reads as a lit ball however faint the
            // material's own opacity is, which is exactly what this layer
            // must not look like.
            const alpha = Math.min(0.72, Math.max(0, noise * falloff * falloff * 1.15 - 0.2));

            const i = (y * size + x) * 4;
            image.data[i] = 255;
            image.data[i + 1] = 255;
            image.data[i + 2] = 255;
            image.data[i + 3] = Math.min(255, Math.round(alpha * 255));
        }
    }
    ctx.putImageData(image, 0, 0);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    cachedHaze[variant] = texture;
    return texture;
}

export const HAZE_TEXTURE_VARIANTS = 4;
