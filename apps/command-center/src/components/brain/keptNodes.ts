import { brainNodes3D } from "../../state/neuralNetwork3D";
import { isBelowStemCutoff, STEM_CUTOFF_Y } from "./brainTopology";

// The stem/neck taper has very few raw points to begin with (see
// brainTopology) — applying the same keep rate there as everywhere else
// left it looking like almost nothing survived. Nodes in this band above
// the stem cutoff are kept more liberally than the main mass so the neck
// still reads as connected. The band itself is intentionally short — the
// lower part of the main mass (the bottom of the lobes, right before the
// taper starts) should still look like part of the lobes, not part of
// the neck, so only the genuinely narrow tail gets the neck treatment.
// Widened from the lobe/neck boundary used earlier (+0.3) to +0.4 — the
// generic outer/mid/inner falloff below naturally thins out right near
// the equator (points there are close to the box center in normalized
// radius, landing in the sparser mid/inner tiers), and since the neck's
// own liberal keep rate used to start exactly at that thin equatorial
// band, the sudden jump from "sparse equator" to "dense neck top" read
// as a pinched hourglass waist. Starting the neck's liberal zone a bit
// higher, where the lobes are still comfortably dense on their own,
// means the handoff blends into already-solid geometry instead.
export const NECK_ZONE_Y = STEM_CUTOFF_Y + 0.4;
// The neck is wider where it actually attaches to the lobes than at its
// tapered tip (anatomically correct too) — a flat rate through the
// whole zone made the top of the neck look too thin right where it
// should be at its widest. Tapers linearly from NECK_KEEP_FRACTION_TOP
// at NECK_ZONE_Y down to NECK_KEEP_FRACTION_TIP at STEM_CUTOFF_Y.
const NECK_KEEP_FRACTION_TOP = 1;
const NECK_KEEP_FRACTION_TIP = 0.65;

// Everywhere else, nodes are kept based on how close to the brain's
// OUTER surface they are, not a flat random rate — the surface/silhouette
// is what actually reads as "a brain" at a glance, while thinning the
// interior harder barely changes the silhouette.
//
// This is a 3-tier falloff (outer/mid/inner), not a hard outer/inner
// split — a binary split still left visible gaps at points that are
// genuinely "outer" surface but happen to sit near the middle of the Y
// or X range (the lobes' inner faces near the central fissure, and the
// lower main mass right above the neck) since a plain 2-tier cut
// classified them as "inner" and thinned them hard. The middle tier
// catches exactly that band.
//
// The radius itself is normalized per-axis against the BOUNDING BOX
// center (min+max)/2, not the point cloud's mean/centroid — the
// centroid sits well above the box center here, so measuring "outer"
// from it systematically called the bottom "more outer" than the top.
// The box center is symmetric by construction, so top/bottom and
// front/back get treated the same.
const OUTER_KEEP_FRACTION = 0.65;
const MID_KEEP_FRACTION = 0.5;
const INNER_KEEP_FRACTION = 0.4;
// Percentile-rank cutoffs (of normalized radial distance from the
// center) separating the three tiers — outer is the top 45%, mid the
// next 30%, inner the bottom 25%.
const OUTER_PERCENTILE = 0.55;
const MID_PERCENTILE = 0.25;

// Deterministic hash (not Math.random — this runs at module load, not
// inside a React render, but kept pure/deterministic regardless so the
// kept set is stable across reloads).
function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

const TOTAL_NODES = brainNodes3D.length / 3;

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let i = 0; i < TOTAL_NODES; i++) {
    const x = brainNodes3D[i * 3], y = brainNodes3D[i * 3 + 1], z = brainNodes3D[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
}
export const BRAIN_CENTER: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
const halfRangeX = (maxX - minX) / 2;
const halfRangeY = (maxY - minY) / 2;
const halfRangeZ = (maxZ - minZ) / 2;
// Exported so anything else that needs an "outer-ness" measure (e.g.
// BrainHaze) can use the same per-axis-normalized radius rather than a
// plain Euclidean distance, which is biased toward whichever axis
// happens to have the largest raw range (see the BRAIN_CENTER comment
// above for why an unnormalized measure reads as asymmetric).
export const BRAIN_HALF_RANGE: [number, number, number] = [halfRangeX, halfRangeY, halfRangeZ];

const radii = new Float32Array(TOTAL_NODES);
for (let i = 0; i < TOTAL_NODES; i++) {
    const nx = (brainNodes3D[i * 3] - BRAIN_CENTER[0]) / halfRangeX;
    const ny = (brainNodes3D[i * 3 + 1] - BRAIN_CENTER[1]) / halfRangeY;
    const nz = (brainNodes3D[i * 3 + 2] - BRAIN_CENTER[2]) / halfRangeZ;
    radii[i] = Math.sqrt(nx * nx + ny * ny + nz * nz);
}
const sortedRadii = Array.from(radii).sort((a, b) => a - b);
const outerRadiusThreshold = sortedRadii[Math.floor(TOTAL_NODES * OUTER_PERCENTILE)];
const midRadiusThreshold = sortedRadii[Math.floor(TOTAL_NODES * MID_PERCENTILE)];

const keptMask = new Uint8Array(TOTAL_NODES);
for (let i = 0; i < TOTAL_NODES; i++) {
    // Never keep a dot below the trimmed stem cutoff — see brainTopology.
    if (isBelowStemCutoff(i)) {
        keptMask[i] = 0;
        continue;
    }
    const y = brainNodes3D[i * 3 + 1];
    let threshold: number;
    if (y < NECK_ZONE_Y) {
        const taper = Math.max(0, Math.min(1, (y - STEM_CUTOFF_Y) / (NECK_ZONE_Y - STEM_CUTOFF_Y)));
        threshold = NECK_KEEP_FRACTION_TIP + (NECK_KEEP_FRACTION_TOP - NECK_KEEP_FRACTION_TIP) * taper;
    } else if (radii[i] >= outerRadiusThreshold) {
        threshold = OUTER_KEEP_FRACTION;
    } else if (radii[i] >= midRadiusThreshold) {
        threshold = MID_KEEP_FRACTION;
    } else {
        threshold = INNER_KEEP_FRACTION;
    }
    keptMask[i] = hash(i * 3.71) < threshold ? 1 : 0;
}

export function isNodeKept(index: number): boolean {
    return keptMask[index] === 1;
}

export const KEPT_NODE_INDICES: number[] = (() => {
    const arr: number[] = [];
    for (let i = 0; i < TOTAL_NODES; i++) {
        if (keptMask[i]) arr.push(i);
    }
    return arr;
})();
