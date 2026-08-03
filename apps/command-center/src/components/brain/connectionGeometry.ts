import { brainNodes3D, brainConnectionSegments, brainEdges3D } from "../../state/neuralNetwork3D";
import { isNodeKept, KEPT_NODE_INDICES, NECK_ZONE_Y, BRAIN_CENTER, BRAIN_HALF_RANGE } from "./keptNodes";
import { isBelowStemCutoff, crossesFissure, STEM_CUTOFF_Y, FISSURE_Y_THRESHOLD } from "./brainTopology";

const MIN_DEGREE = 5; // every kept node should have at least this many visible connections
// The neck taper naturally has fewer, more colinear points (see
// keptNodes.ts) — a plain MIN_DEGREE there still reads as "a single
// thread" since its few candidates all sit along the same axis. A
// moderate bump plus spreading picks across directions (see
// diverseCandidates) is enough to weave it into a tube. Tapers from
// NECK_MIN_DEGREE_TOP where the neck actually attaches to the lobes
// down to NECK_MIN_DEGREE_TIP at its narrow end — matching keptNodes.ts'
// own top-to-tip taper (see minDegreeFor) so the neck reads as widest
// at the top, not uniformly thick down its whole length.
const NECK_MIN_DEGREE_TOP = 8;
const NECK_MIN_DEGREE_TIP = 4;
// With nodes kept based on outer-shell proximity rather than a flat
// rate (see keptNodes.ts), the average gap between surviving neighbors
// grew in the sparser interior, so this had to grow with it to keep the
// mesh fully closed rather than leaving new gaps. Baked segments now
// also require BOTH endpoints kept (see below), which leans on this
// synthetic pass more than before.
const MAX_SYNTH_DIST = 0.36;
const MAX_SYNTH_DIST_SQ = MAX_SYNTH_DIST * MAX_SYNTH_DIST;
// Tighter than the global distance for the neck specifically — its
// diverseCandidates pass deliberately reaches across the taper for
// cross-bracing, and without its own tighter cap that reach was wide
// enough to make the whole neck look thicker than the point cloud's
// actual girth.
const NECK_MAX_SYNTH_DIST = 0.26;
const NECK_MAX_SYNTH_DIST_SQ = NECK_MAX_SYNTH_DIST * NECK_MAX_SYNTH_DIST;

// The front-most and back-most tips of the brain (extreme Z) taper to a
// point in the underlying data much like the neck does — few raw points
// survive there at all, so even a generous outer-shell keep rate (see
// keptNodes.ts) still leaves visible gaps simply because there isn't
// much to keep. A higher min-degree target plus a wider synthesis
// distance, same idea as the neck's own treatment, stitches whatever
// sparse points ARE there into the surrounding mesh instead of leaving
// them under-connected.
const ZTIP_THRESHOLD = 0.72; // normalized |z| from center, as a fraction of the half-range
const ZTIP_MIN_DEGREE = 6;
const ZTIP_MAX_SYNTH_DIST = 0.5;
const ZTIP_MAX_SYNTH_DIST_SQ = ZTIP_MAX_SYNTH_DIST * ZTIP_MAX_SYNTH_DIST;

function isZTip(idx: number): boolean {
    const nz = (brainNodes3D[idx * 3 + 2] - BRAIN_CENTER[2]) / BRAIN_HALF_RANGE[2];
    return Math.abs(nz) >= ZTIP_THRESHOLD;
}

function minDegreeFor(idx: number): number {
    const y = brainNodes3D[idx * 3 + 1];
    if (y < NECK_ZONE_Y) {
        const taper = Math.max(0, Math.min(1, (y - STEM_CUTOFF_Y) / (NECK_ZONE_Y - STEM_CUTOFF_Y)));
        return Math.round(NECK_MIN_DEGREE_TIP + (NECK_MIN_DEGREE_TOP - NECK_MIN_DEGREE_TIP) * taper);
    }
    if (isZTip(idx)) return ZTIP_MIN_DEGREE;
    return MIN_DEGREE;
}

// Deterministic hash (not Math.random — this runs once at module load)
// used to bow synthetic gap-filling segments slightly, matching the
// baked data's "bent, not straight" polylines.
function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

function pairKey(a: number, b: number): string {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/**
 * Builds the full flattened LineSegments vertex buffer for every visible
 * brain connection — baked + synthetic gap-fill + fissure seam — exactly
 * once at module load (this is pure/deterministic, no props or state).
 *
 * Shared by ConnectionLayer (which renders it as the actual connection
 * lines) AND BrainHaze (which uses these same vertices, NOT the raw
 * neuron node positions, as its glow sprite positions) — that's what
 * makes the haze hug the lines themselves rather than pooling around
 * each particle dot.
 *
 * See ConnectionLayer.tsx's own doc comment for the baked-vs-synthetic
 * rules this follows.
 */
function buildConnectionPositions(): Float32Array {
    const kept: number[] = [];
    const degree = new Map<number, number>();
    const existingPairs = new Set<string>();

    brainConnectionSegments.forEach((seg, i) => {
        const [a, b] = brainEdges3D[i];
        if (isBelowStemCutoff(a) || isBelowStemCutoff(b)) return;
        if (!isNodeKept(a) || !isNodeKept(b)) return;
        if (crossesFissure(a, b)) return;

        // seg = [ax,ay,az, mx,my,mz, bx,by,bz] -> two segments: a-m, m-b
        kept.push(
            seg[0], seg[1], seg[2], seg[3], seg[4], seg[5],
            seg[3], seg[4], seg[5], seg[6], seg[7], seg[8],
        );
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
        existingPairs.add(pairKey(a, b));
    });

    const connect = (idx: number, other: number) => {
        existingPairs.add(pairKey(idx, other));
        degree.set(idx, (degree.get(idx) ?? 0) + 1);
        degree.set(other, (degree.get(other) ?? 0) + 1);

        const ax = brainNodes3D[idx * 3], ay = brainNodes3D[idx * 3 + 1], az = brainNodes3D[idx * 3 + 2];
        const bx = brainNodes3D[other * 3], by = brainNodes3D[other * 3 + 1], bz = brainNodes3D[other * 3 + 2];
        const seed = idx * 10007 + other;
        // Longer synthetic spans (more common now that nodes sit
        // farther apart) get a proportionally bigger bow — a fixed
        // small bow read as a flat, angular chord cutting across the
        // surface on the longer ones, which fought against the
        // rounder look being aimed for here.
        const dist = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
        const bow = Math.min(0.1, Math.max(0.03, dist * 0.2));
        const mx0 = (ax + bx) / 2, my0 = (ay + by) / 2, mz0 = (az + bz) / 2;
        // Bow mostly OUTWARD from the brain's center (a chain of
        // synthetic edges around the perimeter then arcs along the
        // silhouette like a real curved surface) with a smaller
        // random component layered on top for organic irregularity —
        // a purely random bow direction let neighboring segments bow
        // toward each other/inward at random, which read as jagged
        // rather than a smooth rounded contour.
        const outX = mx0 - BRAIN_CENTER[0], outY = my0 - BRAIN_CENTER[1], outZ = mz0 - BRAIN_CENTER[2];
        const outLen = Math.sqrt(outX * outX + outY * outY + outZ * outZ) || 1;
        const mx = mx0 + (outX / outLen) * bow * 0.7 + (hash(seed) - 0.5) * bow * 0.5;
        const my = my0 + (outY / outLen) * bow * 0.7 + (hash(seed * 1.7) - 0.5) * bow * 0.5;
        const mz = mz0 + (outZ / outLen) * bow * 0.7 + (hash(seed * 2.3) - 0.5) * bow * 0.5;

        kept.push(ax, ay, az, mx, my, mz, mx, my, mz, bx, by, bz);
    };

    const nearestCandidates = (idx: number, maxDistSq: number) => {
        const candidates: { other: number; distSq: number; angle: number }[] = [];
        for (const other of KEPT_NODE_INDICES) {
            if (other === idx) continue;
            if (existingPairs.has(pairKey(idx, other))) continue;
            if (crossesFissure(idx, other)) continue;

            const dx = brainNodes3D[idx * 3] - brainNodes3D[other * 3];
            const dy = brainNodes3D[idx * 3 + 1] - brainNodes3D[other * 3 + 1];
            const dz = brainNodes3D[idx * 3 + 2] - brainNodes3D[other * 3 + 2];
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > maxDistSq) continue;

            candidates.push({ other, distSq, angle: Math.atan2(dz, dx) });
        }
        candidates.sort((x, y) => x.distSq - y.distSq);
        return candidates;
    };

    // Same as nearestCandidates, but spreads picks across different
    // horizontal directions (angle buckets around the vertical axis)
    // instead of taking the N nearest overall — pure-nearest tends to
    // pick neighbors strung along the same line, which is exactly
    // what read as "a single thread" through the neck's sparse,
    // roughly-linear taper. Round-robining buckets forces cross-ties
    // to the other side of the taper, weaving it into a tube.
    const ANGLE_BUCKETS = 6;
    const diverseCandidates = (idx: number, maxDistSq: number, need: number) => {
        const all = nearestCandidates(idx, maxDistSq);
        const buckets: { other: number; distSq: number }[][] = Array.from({ length: ANGLE_BUCKETS }, () => []);
        all.forEach((c) => {
            const bucket = Math.floor(((c.angle + Math.PI) / (2 * Math.PI)) * ANGLE_BUCKETS) % ANGLE_BUCKETS;
            buckets[bucket].push(c);
        });
        const picked: { other: number }[] = [];
        let round = 0;
        while (picked.length < need && round < 20) {
            for (let b = 0; b < ANGLE_BUCKETS && picked.length < need; b++) {
                if (buckets[b][round]) picked.push(buckets[b][round]);
            }
            round++;
        }
        return picked;
    };

    // Gap-filling pass: connect under-connected kept nodes to their
    // nearest kept neighbors within a plausible distance — spread
    // across directions for neck-zone nodes (see diverseCandidates),
    // simple nearest-first everywhere else.
    KEPT_NODE_INDICES.forEach((idx) => {
        const target = minDegreeFor(idx);
        const currentDegree = degree.get(idx) ?? 0;
        if (currentDegree >= target) return;

        const need = target - currentDegree;
        const isNeck = brainNodes3D[idx * 3 + 1] < NECK_ZONE_Y;
        let picks;
        if (isNeck) {
            picks = diverseCandidates(idx, NECK_MAX_SYNTH_DIST_SQ, need);
        } else if (isZTip(idx)) {
            picks = diverseCandidates(idx, ZTIP_MAX_SYNTH_DIST_SQ, need);
        } else {
            picks = nearestCandidates(idx, MAX_SYNTH_DIST_SQ).slice(0, need);
        }
        picks.forEach(({ other }) => connect(idx, other));
    });

    // Fissure seam pass: crossesFissure() only ever SUPPRESSES
    // connections, which leaves the groove as an absence. This picks
    // just ONE node total (from EITHER side, whichever sits closest to
    // true x=0) per thin front-to-back (Z) slice, and chains those
    // consecutively, front to back — a single zig-zag-free polyline
    // hugging the true midline, not two separate left/right spines
    // bridged by rungs (which is what read as "branching sideways": two
    // parallel strands plus crossbars between them is inherently a
    // ladder, not a single line, however tight the rungs are). One
    // shared spine also matches real anatomy better — the longitudinal
    // fissure IS a single ridge, not two.
    const FISSURE_BINS = 28;
    let fissureMinZ = Infinity, fissureMaxZ = -Infinity;
    const fissureCandidates = KEPT_NODE_INDICES.filter((idx) => brainNodes3D[idx * 3 + 1] > FISSURE_Y_THRESHOLD);
    fissureCandidates.forEach((idx) => {
        const z = brainNodes3D[idx * 3 + 2];
        if (z < fissureMinZ) fissureMinZ = z;
        if (z > fissureMaxZ) fissureMaxZ = z;
    });

    // Picking purely "closest to x=0" per slice was happy to grab a node
    // from anywhere in that slice's whole DEPTH-of-volume near the
    // midline, including well inside the brain — which is why the seam
    // read as cutting through the center rather than riding along the
    // outer top surface where the two lobes actually meet. Restricting
    // each slice's candidates to their own top ~35% by Y first (i.e.
    // only the outer/top surface of that slice), and only THEN picking
    // the one closest to x=0 among those, keeps the whole spine on the
    // surface ridge instead of dipping into the interior.
    let spine: number[] = [];
    for (let b = 0; b < FISSURE_BINS; b++) {
        const zLo = fissureMinZ + ((fissureMaxZ - fissureMinZ) * b) / FISSURE_BINS;
        const zHi = fissureMinZ + ((fissureMaxZ - fissureMinZ) * (b + 1)) / FISSURE_BINS;
        const inSlice = fissureCandidates.filter((idx) => {
            const z = brainNodes3D[idx * 3 + 2];
            return z >= zLo && z < zHi;
        });
        if (inSlice.length === 0) continue;

        const byY = inSlice.slice().sort((a, c) => brainNodes3D[c * 3 + 1] - brainNodes3D[a * 3 + 1]);
        const topSurface = byY.slice(0, Math.max(1, Math.ceil(byY.length * 0.35)));

        let closest = -1, closestAbsX = Infinity;
        topSurface.forEach((idx) => {
            const absX = Math.abs(brainNodes3D[idx * 3]);
            if (absX < closestAbsX) { closestAbsX = absX; closest = idx; }
        });
        if (closest !== -1) spine.push(closest);
    }

    // Drop any single bin whose pick sits well above the others — a thin
    // slice sometimes only has one or two near-midline candidates at
    // all, and if the closest-to-x=0 one of those happens to also be an
    // unusually tall outlier, it pokes a single stray spike up out of
    // the arc above where the lobes' own silhouette should read cleanly.
    // Skipping it just makes the chain connect straight past that bin to
    // the next one, which stays smooth since neighboring bins' picks are
    // still close together in Z.
    const sortedY = spine.map((idx) => brainNodes3D[idx * 3 + 1]).sort((a, b) => a - b);
    const medianY = sortedY[Math.floor(sortedY.length / 2)];
    spine = spine.filter((idx) => brainNodes3D[idx * 3 + 1] <= medianY + 0.15);

    // Connects the spine into the mesh's own regular connect() calls
    // (same bow-curved geometry as any other synthetic gap-fill line, no
    // separate/brighter re-render) — so it's part of the exact same
    // group as everything else, and picks up whatever rules apply there
    // (like BrainHaze sampling along it) automatically, with nothing
    // fissure-specific to keep in sync. Ignores crossesFissure
    // deliberately (consecutive spine nodes can legitimately sit on
    // opposite sides of x=0) since this single stitched line IS the
    // intentional exception to that rule.
    for (let i = 0; i < spine.length - 1; i++) {
        const a = spine[i], b = spine[i + 1];
        if (existingPairs.has(pairKey(a, b))) continue;
        connect(a, b);
    }

    // Fallback pass: at the lower KEEP_FRACTION, a handful of nodes can
    // still end up totally isolated (their nearest kept neighbors all
    // sit beyond MAX_SYNTH_DIST) — the brain needs to read as ONE
    // connected whole with no floating orphan dots, so these get
    // linked to their single nearest kept neighbor regardless of
    // distance (still respecting the fissure rule).
    KEPT_NODE_INDICES.forEach((idx) => {
        if ((degree.get(idx) ?? 0) > 0) return;
        const [nearest] = nearestCandidates(idx, Infinity);
        if (nearest) connect(idx, nearest.other);
    });

    return new Float32Array(kept);
}

export const connectionPositions: Float32Array = buildConnectionPositions();
