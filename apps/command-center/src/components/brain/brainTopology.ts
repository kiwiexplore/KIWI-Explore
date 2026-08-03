import { brainNodes3D, brainEdges3D } from "../../state/neuralNetwork3D";

// The brain stem tapers to a handful of very-low-Y points that stretch
// the visible "tail" further than it needs to read as a neck. Trimming
// below this cuts the stem shorter without touching the main lobes.
// (An earlier, more aggressive cutoff at -0.55 trimmed so much that the
// neck was barely visible at all — this keeps noticeably more of it.)
export const STEM_CUTOFF_Y = -0.68;

// The central longitudinal fissure should read as an open groove through
// the main lobes — but the baked edge data is pure nearest-neighbor
// (every edge is short, max ~0.16 units), so a handful of edges still
// connect nodes sitting right at the crease, a few hundredths of a unit
// apart on either side. Above this Y, treat a hemisphere-crossing edge
// as "bridging the groove" and exclude it. Below this Y (down toward the
// neck/base) crossings are kept — a real brain IS connected down there,
// and the neck should look fuller, not further split.
export const FISSURE_Y_THRESHOLD = -0.1;

export function isBelowStemCutoff(idx: number): boolean {
    return brainNodes3D[idx * 3 + 1] < STEM_CUTOFF_Y;
}

export function crossesFissure(idxA: number, idxB: number): boolean {
    const xa = brainNodes3D[idxA * 3];
    const xb = brainNodes3D[idxB * 3];
    if (xa < 0 === xb < 0) return false; // same hemisphere, not crossing
    const ya = brainNodes3D[idxA * 3 + 1];
    const yb = brainNodes3D[idxB * 3 + 1];
    return (ya + yb) / 2 > FISSURE_Y_THRESHOLD;
}

/**
 * Real graph adjacency for random-walk pulses — both EnergyLayer's
 * internal pulses and OrbitRing3D's icon-hover pulses share this, so
 * neither ever crosses the fissure or wanders into the trimmed stem tip.
 * Built once at module load (not per-component), since it never changes.
 */
function buildAdjacency(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    brainEdges3D.forEach(([a, b]) => {
        if (isBelowStemCutoff(a) || isBelowStemCutoff(b)) return;
        if (crossesFissure(a, b)) return;
        if (!map.has(a)) map.set(a, []);
        if (!map.has(b)) map.set(b, []);
        map.get(a)!.push(b);
        map.get(b)!.push(a);
    });
    return map;
}

export const brainAdjacency = buildAdjacency();
