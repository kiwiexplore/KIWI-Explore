import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
    Newspaper, Mountain, Calendar, FolderKanban, TrendingUp,
    BookOpen, FileText, Activity, Mail, Plane,
} from "lucide-react";
import {
    AdditiveBlending, BufferAttribute, BufferGeometry,
    Line as ThreeLine, LineBasicMaterial, LineSegments,
    Points as ThreePoints, PointsMaterial,
} from "three";
import { orbitModules } from "../../state/orbitModules";
import { pulseBoost } from "./pulseField";
import { brainNodes3D } from "../../state/neuralNetwork3D";
import { brainSwirlColor } from "./brainColor";
import { KEPT_NODE_INDICES } from "./keptNodes";
import { brainAdjacency } from "./brainTopology";
import { getDotTexture, getHazeTexture } from "./dotTexture";
import "./OrbitRing3D.css";

const RADIUS_X = 1.52;
// Flattened vertically relative to RADIUS_X — a true oval rather than a
// near-circle — so the ring's top/bottom icons sit closer to the brain
// than its left/right icons, fitting inside the available vertical space
// (between the top bar and the bottom widget row) without needing a big
// downward shift of the whole scene to compensate. Not too flattened
// though — kept fairly close to RADIUS_X so it still reads as a rounded
// oval rather than a squashed ellipse.
const RADIUS_Y = 1.18;
// Nudges the ring + icons up relative to the brain — only the ring's own
// curve and the icons' anchor points, NOT the brain itself (that lives
// in a sibling group) and NOT the branch targets (real brain node
// positions, found independently via `target` in layoutModules below) —
// applied inside ringPointAt so both RingConnections (the curve) and
// layoutModules (icon placement) shift together and stay on the same
// curve.
const RING_Y_OFFSET = 0.15;
const INNER_RADIUS = 0.65; // how deep into the brain's volume the connection reaches, not just its outer surface
const FORK_T = 0.6; // fraction of the journey that's a shared trunk before it splits into branches
const AMBIENT_PARTICLES = 9; // 3 per branch — the calm, always-on hint
const HOVER_PATH_LENGTH = 14; // brain nodes the hover pulse hops across, past the entry point
const DRIFT_SPEED = 0.08; // loops per second — halved per explicit request, even slower/more magical
// The graph-walk continuation (the part that actually lights up brain
// nodes past the entry point) cycles through the same fade-in/hold/
// fade-out envelope as EnergyLayer's own pulses — the icon-to-entry
// trunk (icon + all 9 particles) stays constantly bright the whole
// hover, only this deeper part breathes.
const HOVER_DURATION = 6.5;
const HOVER_FADE_IN = 0.15;
const HOVER_FADE_OUT = 0.3;

/**
 * Local icon lookup for the 3D scene only — deliberately NOT stored on
 * the shared orbitModules data, since the 2D SVG OrbitRing still expects
 * `module.icon` to be an emoji string and we don't want to touch that
 * working path. This keeps the 3D upgrade isolated to 3D.
 */
const ICONS: Record<string, typeof Newspaper> = {
    news: Newspaper,
    adventure: Mountain,
    calendar: Calendar,
    projects: FolderKanban,
    finance: TrendingUp,
    learning: BookOpen,
    documents: FileText,
    health: Activity,
    communication: Mail,
    travel: Plane,
};

interface Positioned {
    module: (typeof orbitModules)[number];
    outer: [number, number, number];
    branchIndices: [number, number, number];
}

function findNearestKeptNodes(target: [number, number, number], count: number): number[] {
    const scored = KEPT_NODE_INDICES.map((idx) => {
        const dx = brainNodes3D[idx * 3] - target[0];
        const dy = brainNodes3D[idx * 3 + 1] - target[1];
        const dz = brainNodes3D[idx * 3 + 2] - target[2];
        return { idx, d: dx * dx + dy * dy + dz * dz };
    });
    scored.sort((a, b) => a.d - b.d);
    return scored.slice(0, count).map((s) => s.idx);
}

// A plain, symmetric oval — a true ellipse via RADIUS_X/RADIUS_Y, no
// extra top/bottom distortion on top of that (an earlier version pulled
// the bottom in and pushed the top out unevenly, which read as
// lopsided). Shared by layoutModules (icon positions) AND
// RingConnections (the connecting curve itself), sampled continuously
// there instead of just at the 10 icon angles — that's what makes the
// ring actually read as smoothly round instead of a faceted decagon,
// while icons still sit exactly on it since both use this same formula.
// Returns a point directly (not a scalar radius) since X and Y don't
// share one radius.
function ringPointAt(angle: number): [number, number] {
    return [Math.cos(angle) * RADIUS_X, Math.sin(angle) * RADIUS_Y + RING_Y_OFFSET];
}

function layoutModules(): Positioned[] {
    const n = orbitModules.length;
    const step = (2 * Math.PI) / n;

    return orbitModules.map((module, i) => {
        const angle = step * i - Math.PI / 2;
        const yFactor = Math.sin(angle);
        const [ox, oy] = ringPointAt(angle);
        const outer: [number, number, number] = [ox, oy, 0];
        // Roughly where this icon's energy reaches toward — real, visible
        // brain nodes well inside the brain's volume along this icon's
        // angle (not just grazing its outer surface), used as fork
        // destinations, never rendered as a line to them, so it doesn't
        // matter that the brain rotates underneath these fixed targets —
        // see IconEnergyLink's doc comment. The bottom 5 icons reach in
        // noticeably deeper (more central) than the rest: their targets
        // sit closer to the brain's own Y axis, so even once the brain
        // has rotated away from its rest orientation the target is still
        // plausibly "inside" the current silhouette — a shallower target
        // could end up pointing at empty space where the brain used to be.
        const targetRadius = yFactor < 0 ? INNER_RADIUS * 0.55 : INNER_RADIUS;
        const target: [number, number, number] = [Math.cos(angle) * targetRadius, Math.sin(angle) * targetRadius, 0];
        const [a, b, c] = findNearestKeptNodes(target, 3);

        return { module, outer, branchIndices: [a, b, c] };
    });
}

// Same technique as EnergyLayer's internal pulses: a random walk across
// real graph adjacency, so the hover pulse actually follows the brain's
// own connections rather than a straight line through space.
function randomWalk(start: number, length: number): number[] {
    let current = start;
    const path = [current];
    for (let i = 0; i < length - 1; i++) {
        const neighbors = brainAdjacency.get(current);
        if (!neighbors || neighbors.length === 0) break;
        current = neighbors[Math.floor(Math.random() * neighbors.length)];
        path.push(current);
    }
    while (path.length < length) path.push(path[path.length - 1]);
    return path;
}

// A web segment endpoint — a position plus how visible it should be
// right now (1 for the fixed icon/target anchors, or a live particle's
// own sin(t*pi) fade otherwise — see writeSegment's doc comment).
interface WebVertex {
    p: [number, number, number];
    fade: number;
}

interface IconEnergyLinkProps {
    active: boolean;
    outer: [number, number, number];
    branchIndices: [number, number, number];
    seed: number;
    // Hands the hover-pulse Line object up once, so GlowLayer's
    // SelectiveBloom can include it in the same selection as the brain's
    // own internal pulses — otherwise the hover pulse never actually
    // glows, just draws its (already bright) vertex colors flat.
    onHoverLineReady?: (line: ThreeLine) => void;
}

// Position along one of the three prongs at parameter t (0 = icon,
// 1 = arrival). Shared trunk from the icon out to FORK_T, then forks —
// branch 0 continues on, branches 1/2 peel off toward their own nearby
// brain node, like a lightning bolt forking near its end. The trunk
// itself is a gentle quadratic-bezier bow (not a straight lerp) — a pure
// straight segment there read as "just a straight line into the brain".
function pointOnBranch(
    outer: [number, number, number],
    branches: [number, number, number][],
    branchIdx: number,
    t: number,
): [number, number, number] {
    if (t <= FORK_T) {
        const tt = t / FORK_T;
        const target = branches[0];
        const midX = (outer[0] + target[0]) / 2;
        const midY = (outer[1] + target[1]) / 2;
        const midZ = (outer[2] + target[2]) / 2;
        const angle = Math.atan2(outer[1], outer[0]);
        const bow = 0.16;
        const cx = midX - Math.sin(angle) * bow;
        const cy = midY + Math.cos(angle) * bow;
        const cz = midZ + bow * 0.5;
        const mt = 1 - tt;
        return [
            mt * mt * outer[0] + 2 * mt * tt * cx + tt * tt * target[0],
            mt * mt * outer[1] + 2 * mt * tt * cy + tt * tt * target[1],
            mt * mt * outer[2] + 2 * mt * tt * cz + tt * tt * target[2],
        ];
    }
    const forkPoint = pointOnBranch(outer, branches, branchIdx, FORK_T);
    const target = branches[branchIdx];
    const tt = (t - FORK_T) / (1 - FORK_T);
    return [
        forkPoint[0] + (target[0] - forkPoint[0]) * tt,
        forkPoint[1] + (target[1] - forkPoint[1]) * tt,
        forkPoint[2] + (target[2] - forkPoint[2]) * tt,
    ];
}

// Icon + that branch's own 3 live ambient particles + its target — used
// for the hover comet's trunk. Deliberately the SAME live positions the
// web (see writeSegment) is built from, not a separate fixed curve — an
// earlier version sampled pointOnBranch at fixed t instead, and since
// the web now visibly travels with the drifting particles, that static
// trunk read as a separate, disconnected strand sitting apart from the
// (moving) web around it, per explicit feedback.
const TRUNK_SAMPLES = 5;

// Samples per web segment for the glow-dot overlay — dense enough that
// the sprites visually overlap into one continuous band. WebGL line
// width is unreliable across GPUs (most cap it at 1px), so the thin
// backing line alone reads as basically invisible — same fix
// RingConnections' own glowPoints uses for the same problem.
const WEB_GLOW_SAMPLES_PER_SEGMENT = 3;
// Half of BrainHaze's own opacity (0.0672) — per explicit request that
// this web's smoke read as present but clearly secondary to the brain's
// own haze, not competing with it. Same sprite size as BrainHaze's.
const WEB_HAZE_OPACITY = 0.0336;
const WEB_HAZE_SIZE = 0.17;


/**
 * One icon's connection into the brain has three parts:
 *
 * 1. A calm, always-on drift of ambient motes along a branching path: a
 *    shared trunk out from the icon, forking partway into three prongs,
 *    each reaching a different real, currently-visible brain node.
 *
 * 2. An always-visible web BOUND TO those same live particles (see the
 *    particlesLive-driven block in useFrame, below the ambientPoints
 *    loop) — per branch, a chain from the icon through that branch's own
 *    3 particles (t-sorted so the chain never crosses itself) to its
 *    target, plus 3 cross-branch "rungs" linking corresponding sorted
 *    particles across the 3 branches. Every vertex is a live particle
 *    position, rebuilt every frame, so the whole net visibly travels
 *    WITH the particles as they drift — per explicit request — rather
 *    than sitting on a fixed invisible curve.
 *

 * 3. On hover, ONE traveling pulse on a RANDOMLY chosen prong (re-rolled
 *    each hover and each time it loops) — a slow comet moving from the
 *    icon into the brain and looping continuously for as long as the
 *    icon stays hovered/clicked, rather than a constantly-bright line or
 *    all three prongs lighting up at once. Past the entry node it keeps
 *    going via a random walk across the brain's real graph adjacency
 *    (see brainTopology), nudging pulseBoost at each node it passes.
 */
function IconEnergyLink({ active, outer, branchIndices, seed, onHoverLineReady }: IconEnergyLinkProps) {
    const branches = useMemo<[number, number, number][]>(
        () => branchIndices.map((idx) => [brainNodes3D[idx * 3], brainNodes3D[idx * 3 + 1], brainNodes3D[idx * 3 + 2]]),
        [branchIndices],
    );

    // Each ambient particle is permanently assigned to one of the 3
    // prongs (round-robin) so the fork is always evenly populated.
    const ambientSeeds = useMemo(
        () => Array.from({ length: AMBIENT_PARTICLES }, (_, i) => ({ phase: (i + seed) / AMBIENT_PARTICLES, branch: i % 3 })),
        [seed],
    );

    const ambientPoints = useMemo(() => {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(AMBIENT_PARTICLES * 3), 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(AMBIENT_PARTICLES * 3), 3));
        const material = new PointsMaterial({
            vertexColors: true,
            map: getDotTexture(),
            alphaTest: 0.05,
            size: 0.036,
            sizeAttenuation: true,
            transparent: true,
            depthWrite: false,
        });
        return [new ThreePoints(geometry, material)];
    }, []);

    // The web is built from the LIVE ambient particles themselves, not a
    // fixed invisible curve — the connecting lines are meant to travel
    // WITH the particles as they drift, per explicit request, so the
    // whole thing reads as one net that's always moving and always
    // attached to every particle. Per branch: icon -> its own 3 live
    // particles (t-sorted so the chain doesn't cross itself) -> target,
    // 4 segments. Across branches: 3 "rungs" (one per sorted slot)
    // cross-linking the 3 branches to each other. Buffer SIZES are fixed
    // (3 branches * 4 chain segments + 3 slots * 3 rung edges = 21
    // segments), but positions are rewritten every frame in useFrame
    // below from that frame's live particle positions.
    const WEB_CHAIN_SEGMENTS = 4; // icon-p0, p0-p1, p1-p2, p2-target
    const WEB_RUNG_EDGES = 3; // triangle per slot
    const webSegmentCount = 3 * WEB_CHAIN_SEGMENTS + 3 * WEB_RUNG_EDGES;
    const webLinePositions = useMemo(() => new Float32Array(webSegmentCount * 2 * 3), [webSegmentCount]);
    const webLineColors = useMemo(() => new Float32Array(webSegmentCount * 2 * 3), [webSegmentCount]);
    const webLineRef = useRef<LineSegments>(null);
    const webGlowPositions = useMemo(() => new Float32Array(webSegmentCount * WEB_GLOW_SAMPLES_PER_SEGMENT * 3), [webSegmentCount]);
    const webGlowColors = useMemo(() => new Float32Array(webSegmentCount * WEB_GLOW_SAMPLES_PER_SEGMENT * 3), [webSegmentCount]);
    const webGlowRef = useRef<ThreePoints>(null);
    // One haze sprite per segment (its midpoint) — see WEB_HAZE_OPACITY.
    const webHazePositions = useMemo(() => new Float32Array(webSegmentCount * 3), [webSegmentCount]);
    const webHazeColors = useMemo(() => new Float32Array(webSegmentCount * 3), [webSegmentCount]);
    const webHazeRef = useRef<ThreePoints>(null);

    // Reused every frame for each branch's own 3 particles' live
    // positions — declared outside useFrame so it's not reallocated per
    // frame. particlesLive[branch][slot].
    const particlesLive = useRef<{ t: number; x: number; y: number; z: number }[][]>(
        Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ t: 0, x: 0, y: 0, z: 0 }))),
    );

    // ONE traveling pulse per icon, on a RANDOMLY chosen branch (re-rolled
    // each time hover starts and each time it loops) — not all 3 at once,
    // per explicit request. Path: TRUNK_SAMPLES points along that
    // branch's own LIVE chain (icon, its 3 live particles, its target —
    // the same chain the web is built from, see TRUNK_SAMPLES' doc
    // comment), then continuing via a graph-walk past the entry node
    // exactly as before. A single comet travels the whole thing (trunk
    // included) and loops continuously for as long as the icon stays
    // hovered/active. Wrapped in a 1-element array — mutating the raw
    // useMemo result directly trips the react-hooks/immutability rule.
    const hoverLines = useMemo(() => {
        const pointCount = TRUNK_SAMPLES + HOVER_PATH_LENGTH;
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(pointCount * 3), 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(pointCount * 3), 3));
        const material = new LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: AdditiveBlending,
        });
        return [new ThreeLine(geometry, material)];
    }, []);


    useEffect(() => {
        hoverLines.forEach((ln) => onHoverLineReady?.(ln));
    }, [hoverLines, onHoverLineReady]);

    // The graph-walk continuation's path (and its fade cycle) resets once
    // per hover AND every time it completes a loop — see the wasActive
    // transition below. selectedBranch is re-rolled at the same moments.
    const traveler = useRef<{ path: number[]; elapsed: number }>({ path: [], elapsed: 0 });
    const selectedBranch = useRef(0);
    const wasActive = useRef(false);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;
        const angle = Math.atan2(outer[1], outer[0]);
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);

        ambientPoints.forEach((pts) => {
            const posAttr = pts.geometry.attributes.position as BufferAttribute;
            const colAttr = pts.geometry.attributes.color as BufferAttribute;

            for (let i = 0; i < AMBIENT_PARTICLES; i++) {
                const { phase, branch } = ambientSeeds[i];
                // One-way only (icon -> target), per explicit request —
                // resets via modulo instead of ping-ponging back. The
                // reset itself is a real position jump, but `fade` below
                // has NO brightness floor anymore, so it reaches true
                // zero at t=0 and t=1 — the particle (and the web lines
                // touching it, see below) are fully invisible exactly at
                // the moment of the jump, which is what actually hides it
                // (an earlier attempt kept a 0.34 floor "just in case",
                // and that leftover 34% brightness was exactly what made
                // the jump visible).
                const t = (phase + time * DRIFT_SPEED) % 1;
                const wobble = Math.sin(t * Math.PI * 3 + i * 1.7) * 0.1 * (1 - t);

                const [px, py, pz] = pointOnBranch(outer, branches, branch, t);
                const x = px + perpX * wobble;
                const y = py + perpY * wobble;
                const z = pz;
                posAttr.setXYZ(i, x, y, z);

                const fade = Math.sin(t * Math.PI); // 0 at the icon and at arrival, peak mid-flight
                const local = brainSwirlColor(x, y, z, time);
                const boost = (active ? 1.3 : 1) * fade;
                colAttr.setXYZ(
                    i,
                    Math.min(1, local[0] * boost),
                    Math.min(1, local[1] * boost),
                    Math.min(1, local[2] * boost),
                );

                // This particle's own live position, remembered for the
                // web below — the connecting lines are meant to travel
                // WITH the particles, not sit on a fixed invisible curve.
                const slot = Math.floor(i / 3);
                particlesLive.current[branch][slot] = { t, x, y, z };
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
        });

        // Build the web's CHAIN segments (icon -> this branch's own 3
        // live particles -> target) and cross-branch RUNGS (same slot
        // across the 3 branches), from this frame's live particle
        // positions — both position AND color are rebuilt every frame,
        // since the whole point is that this net travels with the
        // drifting particles instead of staying still. Deliberately NOT
        // sorted by t — connecting by each particle's fixed identity
        // (slot index) instead of its current rank kept things smooth;
        // sorting caused the connected slot to instantly swap between two
        // different particles whenever their t values crossed, which read
        // as the line jumping between them.
        const webLinePosAttr = webLineRef.current?.geometry.attributes.position as BufferAttribute | undefined;
        const webLineColAttr = webLineRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        const webGlowPosAttr = webGlowRef.current?.geometry.attributes.position as BufferAttribute | undefined;
        const webGlowColAttr = webGlowRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        const webHazePosAttr = webHazeRef.current?.geometry.attributes.position as BufferAttribute | undefined;
        const webHazeColAttr = webHazeRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (webLinePosAttr && webLineColAttr && webGlowPosAttr && webGlowColAttr && webHazePosAttr && webHazeColAttr) {
            let seg = 0;
            let glow = 0;
            // Each endpoint carries its own `fade` — 1 for the fixed
            // icon/target anchors (they never move, nothing to hide), or
            // that particle's own sin(t*pi) fade otherwise. Since a
            // one-way particle's reset is a real position jump (see the
            // ambient loop above), fading THIS vertex's own color to zero
            // right as it resets hides the jump in the web too, not just
            // in the particle dot itself.
            const writeSegment = (a: WebVertex, b: WebVertex) => {
                webLinePosAttr.setXYZ(seg * 2, a.p[0], a.p[1], a.p[2]);
                webLinePosAttr.setXYZ(seg * 2 + 1, b.p[0], b.p[1], b.p[2]);
                [a, b].forEach((v, vi) => {
                    const local = brainSwirlColor(v.p[0], v.p[1], v.p[2], time);
                    const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                    const boost = (0.45 / maxChannel) * v.fade;
                    webLineColAttr.setXYZ(seg * 2 + vi, local[0] * boost, local[1] * boost, local[2] * boost);
                });
                for (let s = 0; s < WEB_GLOW_SAMPLES_PER_SEGMENT; s++) {
                    const et = s / (WEB_GLOW_SAMPLES_PER_SEGMENT - 1);
                    const gx = a.p[0] + (b.p[0] - a.p[0]) * et, gy = a.p[1] + (b.p[1] - a.p[1]) * et, gz = a.p[2] + (b.p[2] - a.p[2]) * et;
                    const gFade = a.fade + (b.fade - a.fade) * et;
                    webGlowPosAttr.setXYZ(glow, gx, gy, gz);
                    const local = brainSwirlColor(gx, gy, gz, time);
                    const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                    const boost = (0.5 / maxChannel) * gFade;
                    webGlowColAttr.setXYZ(glow, local[0] * boost, local[1] * boost, local[2] * boost);
                    glow++;
                }
                const mx = (a.p[0] + b.p[0]) / 2, my = (a.p[1] + b.p[1]) / 2, mz = (a.p[2] + b.p[2]) / 2;
                const mFade = (a.fade + b.fade) / 2;
                webHazePosAttr.setXYZ(seg, mx, my, mz);
                const hazeLocal = brainSwirlColor(mx, my, mz, time);
                const hazeMax = Math.max(hazeLocal[0], hazeLocal[1], hazeLocal[2], 0.001);
                const hazeBoost = (1 / hazeMax) * mFade; // value-boost normalized — WEB_HAZE_OPACITY carries the actual intensity
                webHazeColAttr.setXYZ(seg, hazeLocal[0] * hazeBoost, hazeLocal[1] * hazeBoost, hazeLocal[2] * hazeBoost);
                seg++;
            };

            const FIXED: number = 1;
            for (let b = 0; b < 3; b++) {
                const s = particlesLive.current[b];
                const chain: WebVertex[] = [
                    { p: outer, fade: FIXED },
                    { p: [s[0].x, s[0].y, s[0].z], fade: Math.sin(s[0].t * Math.PI) },
                    { p: [s[1].x, s[1].y, s[1].z], fade: Math.sin(s[1].t * Math.PI) },
                    { p: [s[2].x, s[2].y, s[2].z], fade: Math.sin(s[2].t * Math.PI) },
                    { p: branches[b], fade: FIXED },
                ];
                for (let i = 0; i < chain.length - 1; i++) writeSegment(chain[i], chain[i + 1]);
            }
            for (let slot = 0; slot < 3; slot++) {
                const v0: WebVertex = { p: [particlesLive.current[0][slot].x, particlesLive.current[0][slot].y, particlesLive.current[0][slot].z], fade: Math.sin(particlesLive.current[0][slot].t * Math.PI) };
                const v1: WebVertex = { p: [particlesLive.current[1][slot].x, particlesLive.current[1][slot].y, particlesLive.current[1][slot].z], fade: Math.sin(particlesLive.current[1][slot].t * Math.PI) };
                const v2: WebVertex = { p: [particlesLive.current[2][slot].x, particlesLive.current[2][slot].y, particlesLive.current[2][slot].z], fade: Math.sin(particlesLive.current[2][slot].t * Math.PI) };
                writeSegment(v0, v1);
                writeSegment(v1, v2);
                writeSegment(v2, v0);
            }

            webLinePosAttr.needsUpdate = true;
            webLineColAttr.needsUpdate = true;
            webGlowPosAttr.needsUpdate = true;
            webGlowColAttr.needsUpdate = true;
            webHazePosAttr.needsUpdate = true;
            webHazeColAttr.needsUpdate = true;
        }

        if (active && !wasActive.current) {
            selectedBranch.current = Math.floor(Math.random() * 3);
            traveler.current = { path: randomWalk(branchIndices[selectedBranch.current], HOVER_PATH_LENGTH), elapsed: 0 };
            wasActive.current = true;
        } else if (!active) {
            wasActive.current = false;
        }

        if (!active) {
            hoverLines.forEach((ln) => { ln.visible = false; });
            return;
        }

        traveler.current.elapsed += delta;
        let pathProgress = traveler.current.elapsed / HOVER_DURATION;
        if (pathProgress >= 1) {
            // Loops for as long as hovered/clicked — re-rolling a fresh
            // random branch and graph-walk each lap, per explicit request
            // ("vzdy nahodne" / "porad dokola").
            selectedBranch.current = Math.floor(Math.random() * 3);
            traveler.current = { path: randomWalk(branchIndices[selectedBranch.current], HOVER_PATH_LENGTH), elapsed: 0 };
            pathProgress = 0;
        }
        // Same fade-in/hold/fade-out envelope as EnergyLayer's internal
        // pulses — a brief settle at the very start/end of each lap
        // rather than an abrupt cut, even though it otherwise loops
        // continuously.
        const envelope = smoothstep(0, HOVER_FADE_IN, pathProgress) * (1 - smoothstep(1 - HOVER_FADE_OUT, 1, pathProgress));
        const pointCount = TRUNK_SAMPLES + HOVER_PATH_LENGTH;
        const branch = selectedBranch.current;
        const path = traveler.current.path;

        hoverLines.forEach((ln) => {
            ln.visible = true;

            const posAttr = ln.geometry.attributes.position as BufferAttribute;
            const colAttr = ln.geometry.attributes.color as BufferAttribute;

            for (let n = 0; n < pointCount; n++) {
                let px: number, py: number, pz: number, nodeIdx = -1;

                if (n < TRUNK_SAMPLES) {
                    // The SAME live chain the web uses for this branch —
                    // icon, its 3 live particles, then its target — see
                    // TRUNK_SAMPLES' doc comment.
                    if (n === 0) {
                        [px, py, pz] = outer;
                    } else if (n <= 3) {
                        const live = particlesLive.current[branch][n - 1];
                        px = live.x; py = live.y; pz = live.z;
                    } else {
                        [px, py, pz] = branches[branch];
                    }
                } else {
                    const k = n - TRUNK_SAMPLES;
                    nodeIdx = path[k];
                    px = brainNodes3D[nodeIdx * 3];
                    py = brainNodes3D[nodeIdx * 3 + 1];
                    pz = brainNodes3D[nodeIdx * 3 + 2];
                }

                // Comet shape (soft leading edge, long fading tail)
                // traveling the WHOLE path — trunk included — rather than
                // a constantly-bright trunk with only the tail breathing,
                // per explicit request for a pulse moving from the icon
                // into the brain, not a static line.
                const pathT = n / (pointCount - 1);
                const signedDist = pathT - pathProgress;
                const rawBrightness = signedDist > 0 ? Math.max(0, 1 - signedDist * 4) : Math.max(0, 1 + signedDist * 0.5);
                const brightness = rawBrightness * rawBrightness * (3 - 2 * rawBrightness) * envelope;
                posAttr.setXYZ(n, px, py, pz);

                const local = brainSwirlColor(px, py, pz, time);
                const dimR = local[0] * 0.15, dimG = local[1] * 0.16, dimB = local[2] * 0.22;
                const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                const valueBoost = 1 / maxChannel;
                const brightR = Math.min(1, local[0] * valueBoost);
                const brightG = Math.min(1, local[1] * valueBoost);
                const brightB = Math.min(1, local[2] * valueBoost);

                const cr = dimR + (brightR - dimR) * brightness;
                const cg = dimG + (brightG - dimG) * brightness;
                const cb = dimB + (brightB - dimB) * brightness;
                colAttr.setXYZ(n, cr, cg, cb);

                // Light up the actual brain dot near the pulse, same
                // as EnergyLayer's own internal pulses.
                if (nodeIdx !== -1) {
                    const boostIdx = nodeIdx * 3;
                    pulseBoost[boostIdx] = Math.max(pulseBoost[boostIdx], cr);
                    pulseBoost[boostIdx + 1] = Math.max(pulseBoost[boostIdx + 1], cg);
                    pulseBoost[boostIdx + 2] = Math.max(pulseBoost[boostIdx + 2], cb);
                }
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
        });
    });

    return (
        <group>
            <lineSegments ref={webLineRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[webLinePositions, 3]} />
                    <bufferAttribute attach="attributes-color" args={[webLineColors, 3]} />
                </bufferGeometry>
                <lineBasicMaterial vertexColors transparent opacity={0.5} blending={AdditiveBlending} />
            </lineSegments>
            <points ref={webGlowRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[webGlowPositions, 3]} />
                    <bufferAttribute attach="attributes-color" args={[webGlowColors, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    vertexColors
                    map={getDotTexture()}
                    alphaTest={0.05}
                    size={0.026}
                    sizeAttenuation
                    transparent
                    depthWrite={false}
                    blending={AdditiveBlending}
                />
            </points>
            <points ref={webHazeRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[webHazePositions, 3]} />
                    <bufferAttribute attach="attributes-color" args={[webHazeColors, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    vertexColors
                    map={getHazeTexture()}
                    size={WEB_HAZE_SIZE}
                    sizeAttenuation
                    transparent
                    opacity={WEB_HAZE_OPACITY}
                    depthWrite={false}
                    blending={AdditiveBlending}
                />
            </points>
            {ambientPoints.map((p, i) => (
                <primitive key={`a${i}`} object={p} />
            ))}
            {hoverLines.map((ln, i) => (
                <primitive key={`h${i}`} object={ln} />
            ))}
        </group>
    );
}

const RING_SUBSEGMENTS = 48; // dense enough that glowPoints sprites overlap into one continuous band instead of reading as discrete dots

const RING_PULSE_COUNT = 2;
const RING_PULSE_DURATION = 13; // seconds per lap — slowed down further
const RING_FADE_IN = 0.15;
const RING_FADE_OUT = 0.3;

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/**
 * A closed loop connecting every icon to its neighbors, in the same
 * brain-connection color/style — with slow, one-directional energy
 * pulses circling it (never reversing), independent of hover. Icon
 * positions are fixed in world space, so this geometry never needs to
 * be rebuilt per frame — only the traveling pulses' vertex-color
 * gradient does.
 *
 * Uses the exact same technique as EnergyLayer's internal brain pulses:
 * each pulse fades in from nothing, sweeps once around the ring, then
 * fades back out before restarting — rather than a permanently visible
 * comet with a "breathing" resting glow — so the ring reads as the same
 * kind of living pulse the brain itself has, not a distinct effect.
 */
function RingConnections({ positioned }: { positioned: Positioned[] }) {
    // Staggered starting points within one cycle so the pulses are evenly
    // spaced around the loop rather than bunched together.
    const travelers = useRef<{ elapsed: number }[]>(
        Array.from({ length: RING_PULSE_COUNT }, (_, i) => ({ elapsed: (i * RING_PULSE_DURATION) / RING_PULSE_COUNT })),
    );

    const { lines, glowPoints, pointCount } = useMemo(() => {
        // Sampled as a smooth continuous curve (ringPointAt at many
        // angles), NOT by interpolating straight chords between the 10
        // icon positions — connecting the actual icon points directly
        // produced a visibly faceted decagon (10 flat sides) rather than
        // a round ring, especially since the icons themselves aren't
        // evenly spaced in radius (see ringPointAt's oval + egg-shape).
        // This still passes exactly through every icon's own position,
        // since layoutModules uses this identical formula.
        const totalPoints = positioned.length * RING_SUBSEGMENTS;
        const pts: [number, number, number][] = [];
        for (let s = 0; s < totalPoints; s++) {
            const angle = (s / totalPoints) * Math.PI * 2 - Math.PI / 2;
            const [x, y] = ringPointAt(angle);
            pts.push([x, y, 0]);
        }

        const positions = new Float32Array(pts.length * 3);
        pts.forEach((p, i) => {
            positions[i * 3] = p[0];
            positions[i * 3 + 1] = p[1];
            positions[i * 3 + 2] = p[2];
        });

        const lineGeometry = new BufferGeometry();
        lineGeometry.setAttribute("position", new BufferAttribute(positions, 3));
        lineGeometry.setAttribute("color", new BufferAttribute(new Float32Array(pts.length * 3), 3));
        const lineMaterial = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });

        // A soft round-sprite overlay along the exact same points as the
        // line — WebGL line width is unreliable across GPUs (most cap it
        // at 1px), so this is what actually makes the ring read as a
        // thicker, more luminous band instead of a hairline.
        const glowGeometry = new BufferGeometry();
        glowGeometry.setAttribute("position", new BufferAttribute(positions, 3));
        glowGeometry.setAttribute("color", new BufferAttribute(new Float32Array(pts.length * 3), 3));
        const glowMaterial = new PointsMaterial({
            vertexColors: true,
            map: getDotTexture(),
            alphaTest: 0.02,
            size: 0.032,
            sizeAttenuation: true,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
        });

        return {
            lines: [new ThreeLine(lineGeometry, lineMaterial)],
            glowPoints: [new ThreePoints(glowGeometry, glowMaterial)],
            pointCount: pts.length,
        };
    }, [positioned]);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;
        const posAttr = lines[0].geometry.attributes.position as BufferAttribute;

        // Each pulse independently fades in, sweeps once around the loop,
        // then fades out and restarts — same envelope as EnergyLayer.
        const pulses = travelers.current.map((tr) => {
            tr.elapsed = (tr.elapsed + delta) % RING_PULSE_DURATION;
            const progress = tr.elapsed / RING_PULSE_DURATION;
            const envelope = smoothstep(0, RING_FADE_IN, progress) * (1 - smoothstep(1 - RING_FADE_OUT, 1, progress));
            return { progress, envelope };
        });

        const colors: number[][] = [];
        const brightnesses: number[] = [];
        for (let i = 0; i < pointCount; i++) {
            const t = i / pointCount;

            let brightness = 0;
            pulses.forEach(({ progress, envelope }) => {
                let signedDist = t - progress;
                if (signedDist > 0.5) signedDist -= 1;
                if (signedDist < -0.5) signedDist += 1;
                // Both edges decay much faster than EnergyLayer's own
                // comet (which fades out gradually over a long 40-node
                // open path) — the ring IS the whole path here (it's a
                // closed loop, there's no "elsewhere" off to the side),
                // so a gentle decay tuned for a sprawling network instead
                // covered almost the entire ring at once. A short, tight
                // comet is what actually reads as "a pulse traveling
                // around," with most of the ring dark at any moment.
                const rawBrightness = signedDist > 0 ? Math.max(0, 1 - signedDist * 10) : Math.max(0, 1 + signedDist * 6);
                const eased = rawBrightness * rawBrightness * (3 - 2 * rawBrightness) * envelope;
                brightness = Math.max(brightness, eased);
            });

            // Same living color field + dim/bright blend as the brain's
            // own pulses (EnergyLayer/hover), instead of a fixed
            // blue-to-white gradient — so the ring visibly matches.
            const px = posAttr.getX(i), py = posAttr.getY(i), pz = posAttr.getZ(i);
            const local = brainSwirlColor(px, py, pz, time);
            const dimR = local[0] * 0.15, dimG = local[1] * 0.16, dimB = local[2] * 0.22;
            const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
            const valueBoost = 1 / maxChannel;
            const brightR = Math.min(1, local[0] * valueBoost);
            const brightG = Math.min(1, local[1] * valueBoost);
            const brightB = Math.min(1, local[2] * valueBoost);

            colors.push([
                dimR + (brightR - dimR) * brightness,
                dimG + (brightG - dimG) * brightness,
                dimB + (brightB - dimB) * brightness,
            ]);
            brightnesses.push(brightness);
        }

        lines.forEach((ln) => {
            const colAttr = ln.geometry.attributes.color as BufferAttribute;
            colors.forEach((c, i) => colAttr.setXYZ(i, c[0], c[1], c[2]));
            colAttr.needsUpdate = true;
        });
        glowPoints.forEach((pts) => {
            const colAttr = pts.geometry.attributes.color as BufferAttribute;
            // The glow overlay only lights up near the comets — at rest
            // it stays basically off, so it reads as extra thickness on
            // the bright sweep rather than a permanent haze over the ring.
            colors.forEach((c, i) => {
                const glowStrength = brightnesses[i];
                colAttr.setXYZ(i, c[0] * glowStrength, c[1] * glowStrength, c[2] * glowStrength);
            });
            colAttr.needsUpdate = true;
        });
    });

    return (
        <group>
            {lines.map((ln, i) => (
                <primitive key={`l${i}`} object={ln} />
            ))}
            {glowPoints.map((p, i) => (
                <primitive key={`g${i}`} object={p} />
            ))}
        </group>
    );
}

interface OrbitRing3DProps {
    // All 10 icons' hover-pulse Line objects, reported once fully
    // collected — see IconEnergyLink's onHoverLineReady doc.
    onHoverLinesReady?: (lines: ThreeLine[]) => void;
    // Fired when an icon itself is clicked (not hovered) — opens that
    // module's detail card, anchored at the icon's own screen position
    // (see BrainScene3D / DetailDrawer).
    onModuleClick?: (moduleId: string, anchor: { x: number; y: number }) => void;
    // A module whose detail drawer is currently open — its hover glow
    // stays lit even after the mouse moves away (e.g. toward the
    // drawer), only clearing once the drawer closes AND the mouse isn't
    // over it either. Set by BrainScene3D.
    activeModuleId?: string | null;
}

export default function OrbitRing3D({ onHoverLinesReady, onModuleClick, activeModuleId }: OrbitRing3DProps) {
    const positioned = useMemo(() => layoutModules(), []);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const collectedHoverLines = useRef<ThreeLine[]>([]);

    const handleHoverLineReady = (line: ThreeLine) => {
        collectedHoverLines.current.push(line);
        // 1 hover line per icon — a single randomly-selected branch's
        // traveling pulse — see IconEnergyLink.
        if (collectedHoverLines.current.length === positioned.length) {
            onHoverLinesReady?.(collectedHoverLines.current);
        }
    };

    return (
        <group>

            <RingConnections positioned={positioned} />

            {positioned.map(({ module, outer, branchIndices }, i) => (
                <IconEnergyLink
                    key={module.id}
                    active={hoveredId === module.id || activeModuleId === module.id}
                    outer={outer}
                    branchIndices={branchIndices}
                    seed={i}
                    onHoverLineReady={handleHoverLineReady}
                />
            ))}

            {positioned.map(({ module, outer }) => {
                const Icon = ICONS[module.id];

                return (
                    <Html key={module.id} position={outer} center distanceFactor={6}>
                        <div className="orbit3d-node">

                            <div
                                className="orbit3d-circle"
                                onMouseEnter={() => setHoveredId(module.id)}
                                onMouseLeave={() => setHoveredId((current) => (current === module.id ? null : current))}
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onModuleClick?.(module.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                                }}
                            >

                                {Icon && <Icon size={23} color="#eaf6ff" strokeWidth={1.75} />}

                                {module.badgeCount !== undefined && (
                                    <span className="orbit3d-badge">{module.badgeCount}</span>
                                )}

                            </div>

                            <div className="orbit3d-label">{module.label}</div>

                        </div>
                    </Html>
                );
            })}

        </group>
    );
}
