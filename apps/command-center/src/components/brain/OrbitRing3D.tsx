import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
    Newspaper, Mountain, Calendar, FolderKanban, TrendingUp,
    BookOpen, FileText, Activity, Mail, Plane,
} from "lucide-react";
import {
    AdditiveBlending, BufferAttribute, BufferGeometry,
    Line as ThreeLine, LineBasicMaterial,
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

const RADIUS_X = 1.58;
// Flattened vertically relative to RADIUS_X — a true oval rather than a
// near-circle — so the ring's top/bottom icons sit closer to the brain
// than its left/right icons, fitting inside the available vertical space
// (between the top bar and the bottom widget row) without needing a big
// downward shift of the whole scene to compensate. Not too flattened
// though — kept fairly close to RADIUS_X so it still reads as a rounded
// oval rather than a squashed ellipse.
const RADIUS_Y = 1.22;
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

const PARTICLES_PER_BRANCH = AMBIENT_PARTICLES / 3;

/**
 * One icon's connection into the brain has two parts:
 *
 * 1. A calm, always-on drift of ambient motes along a branching path: a
 *    shared trunk out from the icon, forking partway into three prongs,
 *    each reaching a different real, currently-visible brain node, like
 *    a lightning bolt forking near its end rather than a single wire.
 *
 * 2. On hover, THREE bright lines — one per prong, not just branch 0 —
 *    each built by threading through the CURRENT positions of that
 *    prong's own 3 ambient particles, read straight out of the same
 *    values ambientPoints is writing this frame — so each strand moves
 *    exactly as its particles drift. Past its own entry node each keeps
 *    going via its own random walk across the brain's real graph
 *    adjacency (see brainTopology), nudging pulseBoost at each node it
 *    passes. Unlike EnergyLayer's internal pulses, none of the three
 *    fade in/out or travel as a comet on their trunk — they light up at
 *    full brightness for as long as the icon is hovered, per feedback
 *    that a fade cycle read as "flickering" rather than a steady
 *    connection (only the graph-walk tail past the entry node breathes).
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

    // Three strands, one per branch: icon + that branch's own 3 ambient
    // particles' live positions + a graph-walk continuation past that
    // branch's own entry node.
    const hoverLines = useMemo(() => {
        const pointCount = 1 + PARTICLES_PER_BRANCH + HOVER_PATH_LENGTH;
        return Array.from({ length: 3 }, () => {
            const geometry = new BufferGeometry();
            geometry.setAttribute("position", new BufferAttribute(new Float32Array(pointCount * 3), 3));
            geometry.setAttribute("color", new BufferAttribute(new Float32Array(pointCount * 3), 3));
            const material = new LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.95,
                blending: AdditiveBlending,
            });
            return new ThreeLine(geometry, material);
        });
    }, []);

    useEffect(() => {
        hoverLines.forEach((ln) => onHoverLineReady?.(ln));
    }, [hoverLines, onHoverLineReady]);

    // The graph-walk continuations' paths (and their shared fade cycle)
    // reset once per hover — see the wasActive transition below. One
    // path per branch, all cycling on the same shared timer.
    const traveler = useRef<{ paths: number[][]; elapsed: number }>({ paths: [[], [], []], elapsed: 0 });
    const wasActive = useRef(false);

    // Reused every frame for each branch's own 3 particles' live
    // positions — declared outside useFrame so it's not reallocated per
    // frame. particlesLive[branch][slot].
    const particlesLive = useRef<{ t: number; x: number; y: number; z: number }[][]>(
        Array.from({ length: 3 }, () => Array.from({ length: PARTICLES_PER_BRANCH }, () => ({ t: 0, x: 0, y: 0, z: 0 }))),
    );

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
                const t = (phase + time * DRIFT_SPEED) % 1;
                const wobble = Math.sin(t * Math.PI * 3 + i * 1.7) * 0.1 * (1 - t);

                const [px, py, pz] = pointOnBranch(outer, branches, branch, t);
                const x = px + perpX * wobble;
                const y = py + perpY * wobble;
                const z = pz;
                posAttr.setXYZ(i, x, y, z);

                const fade = Math.sin(t * Math.PI); // 0 at the icon and at arrival, peak mid-flight
                const local = brainSwirlColor(x, y, z, time);
                const boost = (active ? 1.3 : 1) * (0.34 + fade * 0.85);
                colAttr.setXYZ(
                    i,
                    Math.min(1, local[0] * boost),
                    Math.min(1, local[1] * boost),
                    Math.min(1, local[2] * boost),
                );

                // This branch's hover line threads through this SAME
                // particle — the ambient dot's own natural position, not
                // forced onto another branch's curve, since each branch
                // now gets its own strand.
                const slot = Math.floor(i / 3);
                particlesLive.current[branch][slot] = { t, x, y, z };
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
        });
        particlesLive.current.forEach((slots) => slots.sort((a, b) => a.t - b.t));

        if (active && !wasActive.current) {
            traveler.current = { paths: branchIndices.map((idx) => randomWalk(idx, HOVER_PATH_LENGTH)), elapsed: 0 };
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
            traveler.current = { paths: branchIndices.map((idx) => randomWalk(idx, HOVER_PATH_LENGTH)), elapsed: 0 };
            pathProgress = 0;
        }
        // Same fade-in/hold/fade-out envelope as EnergyLayer's internal
        // pulses, shared by all three branches — only each graph-walk
        // continuation (past its own entry node) breathes with it; the
        // trunk stays constant.
        const envelope = smoothstep(0, HOVER_FADE_IN, pathProgress) * (1 - smoothstep(1 - HOVER_FADE_OUT, 1, pathProgress));
        const pointCount = 1 + PARTICLES_PER_BRANCH + HOVER_PATH_LENGTH;

        hoverLines.forEach((ln, b) => {
            ln.visible = true;

            const path = traveler.current.paths[b];
            const posAttr = ln.geometry.attributes.position as BufferAttribute;
            const colAttr = ln.geometry.attributes.color as BufferAttribute;

            for (let n = 0; n < pointCount; n++) {
                let px: number, py: number, pz: number, nodeIdx = -1;
                let brightness = 1; // trunk (icon + particles): constant, no fade

                if (n === 0) {
                    // The icon itself — fixed anchor for the strand.
                    [px, py, pz] = outer;
                } else if (n <= PARTICLES_PER_BRANCH) {
                    const live = particlesLive.current[b][n - 1];
                    px = live.x; py = live.y; pz = live.z;
                } else {
                    const k = n - 1 - PARTICLES_PER_BRANCH;
                    nodeIdx = path[k];
                    px = brainNodes3D[nodeIdx * 3];
                    py = brainNodes3D[nodeIdx * 3 + 1];
                    pz = brainNodes3D[nodeIdx * 3 + 2];

                    // Comet shape (soft leading edge, long fading tail)
                    // traveling across the path, scaled by the envelope.
                    const pathT = k / (HOVER_PATH_LENGTH - 1);
                    const signedDist = pathT - pathProgress;
                    const rawBrightness = signedDist > 0 ? Math.max(0, 1 - signedDist * 4) : Math.max(0, 1 + signedDist * 0.5);
                    brightness = rawBrightness * rawBrightness * (3 - 2 * rawBrightness) * envelope;
                }
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

// Half of BrainHaze's own opacity (0.0672) — per explicit request that
// this web's smoke read as present but clearly secondary to the brain's
// own haze, not competing with it.
const WEB_HAZE_OPACITY = 0.0336;

/**
 * Now that each icon reaches into the brain via 3 separate branches (see
 * IconEnergyLink), this connects those 3 branch endpoints TO EACH OTHER
 * too — a small triangle per icon — so the whole thing reads as a
 * spider-web sitting where each icon's energy fans into the brain,
 * rather than 3 branches that only ever meet back at the icon. Always
 * visible (not hover-gated) and rendered once from the same
 * `branchIndices` layoutModules already computed, in the same style as
 * the brain's own connections (ConnectionLayer) so it reads as part of
 * the same structure. A faint haze along these new edges (see
 * BrainHaze) at half its intensity ties it visually to the rest of the
 * brain's smoke without overpowering it.
 */
function BranchWeb({ positioned }: { positioned: Positioned[] }) {
    const { linePositions, hazePositions } = useMemo(() => {
        const lines: number[] = [];
        const haze: number[] = [];
        positioned.forEach(({ branchIndices }) => {
            const pts = branchIndices.map((idx): [number, number, number] => [
                brainNodes3D[idx * 3], brainNodes3D[idx * 3 + 1], brainNodes3D[idx * 3 + 2],
            ]);
            const edges: [number, number][] = [[0, 1], [1, 2], [2, 0]];
            edges.forEach(([a, b]) => {
                const [ax, ay, az] = pts[a];
                const [bx, by, bz] = pts[b];
                lines.push(ax, ay, az, bx, by, bz);
                haze.push((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
            });
        });
        return { linePositions: new Float32Array(lines), hazePositions: new Float32Array(haze) };
    }, [positioned]);

    const hazeColors = useMemo(() => new Float32Array(hazePositions.length), [hazePositions]);
    const hazeRef = useRef<ThreePoints>(null);

    useFrame((state) => {
        const attr = hazeRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (!attr) return;
        const time = state.clock.elapsedTime;
        const count = hazePositions.length / 3;
        for (let n = 0; n < count; n++) {
            const x = hazePositions[n * 3], y = hazePositions[n * 3 + 1], z = hazePositions[n * 3 + 2];
            const base = brainSwirlColor(x, y, z, time);
            // Same value-boost normalization BrainHaze uses — keeps every
            // sample the same brightness regardless of which hue it is.
            const maxChannel = Math.max(base[0], base[1], base[2], 0.001);
            const boost = 1 / maxChannel;
            attr.setXYZ(n, base[0] * boost, base[1] * boost, base[2] * boost);
        }
        attr.needsUpdate = true;
    });

    return (
        <group>
            <lineSegments>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
                </bufferGeometry>
                <lineBasicMaterial color="#6fd4ff" transparent opacity={0.35} />
            </lineSegments>
            <points ref={hazeRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[hazePositions, 3]} />
                    <bufferAttribute attach="attributes-color" args={[hazeColors, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    vertexColors
                    map={getHazeTexture()}
                    size={0.17}
                    sizeAttenuation
                    transparent
                    opacity={WEB_HAZE_OPACITY}
                    depthWrite={false}
                    blending={AdditiveBlending}
                />
            </points>
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
        // 3 hover lines per icon now (one per branch) — see IconEnergyLink.
        if (collectedHoverLines.current.length === positioned.length * 3) {
            onHoverLinesReady?.(collectedHoverLines.current);
        }
    };

    return (
        <group>

            <RingConnections positioned={positioned} />
            <BranchWeb positioned={positioned} />

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
