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
import { brainNodes3D } from "../../state/neuralNetwork3D";
import { brainSwirlColor } from "./brainColor";
import { KEPT_NODE_INDICES } from "./keptNodes";
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
const FORK_T = 0.3; // small — the fork sits close to the icon so the widening spread happens in the open space before the brain, see pointOnBranch
const AMBIENT_PARTICLES = 12; // spread across the web's ~24 edges

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

interface IconEnergyLinkProps {
    active: boolean;
    outer: [number, number, number];
    branchIndices: [number, number, number];
    // Hands the hover-glow Points object up once, so GlowLayer's
    // SelectiveBloom can include it in the same selection as the brain's
    // own internal pulses — otherwise hovering never actually makes the
    // particles glow, just draws their (already bright) vertex colors
    // flat. A Points object, not a Line — per explicit request, hover
    // brightens the traveling PARTICLES now, not a line.
    onHoverPointsReady?: (points: ThreePoints) => void;
}

// Position along one of the three prongs at parameter t (0 = icon,
// 1 = arrival). Shared trunk from the icon out to FORK_T, then forks
// toward each branch's own nearby brain node, like a lightning bolt.
// The fork point sits FORK_T of the way from the icon toward the 3
// targets' shared centroid — deliberately close to the icon (a small
// fraction), NOT at any one target's own position — an earlier version
// bowed the trunk directly toward branches[0] specifically, which meant
// the "fork" always landed exactly on that one real (deep, buried)
// brain node regardless of FORK_T's value, so the web's widening spread
// was invisible, hidden inside the brain's own dense mesh instead of
// happening in the open space between icon and brain, per explicit
// feedback that convergence-at-the-icon/spread-toward-the-brain needs
// to actually be visible.
function pointOnBranch(
    outer: [number, number, number],
    branches: [number, number, number][],
    branchIdx: number,
    t: number,
): [number, number, number] {
    const centroid: [number, number, number] = [
        (branches[0][0] + branches[1][0] + branches[2][0]) / 3,
        (branches[0][1] + branches[1][1] + branches[2][1]) / 3,
        (branches[0][2] + branches[1][2] + branches[2][2]) / 3,
    ];
    const forkPoint: [number, number, number] = [
        outer[0] + (centroid[0] - outer[0]) * FORK_T,
        outer[1] + (centroid[1] - outer[1]) * FORK_T,
        outer[2] + (centroid[2] - outer[2]) * FORK_T,
    ];
    if (t <= FORK_T) {
        const tt = t / FORK_T;
        const midX = (outer[0] + forkPoint[0]) / 2;
        const midY = (outer[1] + forkPoint[1]) / 2;
        const midZ = (outer[2] + forkPoint[2]) / 2;
        const angle = Math.atan2(outer[1], outer[0]);
        const bow = 0.1;
        const cx = midX - Math.sin(angle) * bow;
        const cy = midY + Math.cos(angle) * bow;
        const cz = midZ + bow * 0.5;
        const mt = 1 - tt;
        return [
            mt * mt * outer[0] + 2 * mt * tt * cx + tt * tt * forkPoint[0],
            mt * mt * outer[1] + 2 * mt * tt * cy + tt * tt * forkPoint[1],
            mt * mt * outer[2] + 2 * mt * tt * cz + tt * tt * forkPoint[2],
        ];
    }
    const target = branches[branchIdx];
    const tt = (t - FORK_T) / (1 - FORK_T);
    return [
        forkPoint[0] + (target[0] - forkPoint[0]) * tt,
        forkPoint[1] + (target[1] - forkPoint[1]) * tt,
        forkPoint[2] + (target[2] - forkPoint[2]) * tt,
    ];
}

// Samples per web edge for the glow-dot overlay — dense enough that the
// sprites visually overlap into one continuous band. WebGL line width is
// unreliable across GPUs (most cap it at 1px), so the thin backing line
// alone reads as basically invisible — same fix RingConnections' own
// glowPoints uses for the same problem.
const WEB_GLOW_SAMPLES_PER_EDGE = 3;
// Half of BrainHaze's own opacity (0.0672) — per explicit request that
// this web's smoke read as present but clearly secondary to the brain's
// own haze, not competing with it. Same sprite size as BrainHaze's.
const WEB_HAZE_OPACITY = 0.0336;
const WEB_HAZE_SIZE = 0.17;
// How far each particle travels per second, as a fraction of one edge's
// length — an edge-to-edge hop takes roughly 1/PARTICLE_EDGE_SPEED
// seconds regardless of that edge's actual length (same simplification
// pointOnBranch's t already uses elsewhere in this file).
const PARTICLE_EDGE_SPEED = 0.35;

// The web's shape: converged at the icon, spreading out toward the
// brain, per explicit request. A shared trunk from the icon (t=0) to a
// fork point (t=FORK_T) — subdivided into 3 short edges so the trunk's
// gentle bow (see pointOnBranch) still reads as a curve, not a straight
// line — then 3 diverging prongs, each subdivided into 3 more "rung
// levels" plus its own final brain-node target. Rungs cross-link the 3
// prongs to each other at each of those 3 levels (not at the targets
// themselves, which stay 3 distinct real brain nodes).
const TRUNK_NODE_TS = [0, FORK_T / 2, FORK_T];
const PRONG_LEVEL_FRACTIONS = [0.25, 0.5, 0.75, 1]; // fraction of the way from FORK_T to 1; last one IS the target

interface WebGraph {
    nodePositions: [number, number, number][];
    edges: [number, number][]; // index pairs into nodePositions
    adjacency: number[][]; // nodePositions index -> edge indices touching it
}

function buildWebGraph(outer: [number, number, number], branches: [number, number, number][]): WebGraph {
    const nodePositions: [number, number, number][] = [];
    const edges: [number, number][] = [];

    TRUNK_NODE_TS.forEach((t) => nodePositions.push(pointOnBranch(outer, branches, 0, t)));
    for (let i = 0; i < TRUNK_NODE_TS.length - 1; i++) edges.push([i, i + 1]);
    const forkIdx = TRUNK_NODE_TS.length - 1;

    // Per prong: [level1, level2, level3, target] node indices — used
    // below to wire up the cross-branch rungs.
    const prongNodeIdx: number[][] = [0, 1, 2].map((branchIdx) => {
        const idxs: number[] = [];
        let prev = forkIdx;
        PRONG_LEVEL_FRACTIONS.forEach((frac) => {
            const t = FORK_T + frac * (1 - FORK_T);
            const idx = nodePositions.length;
            nodePositions.push(pointOnBranch(outer, branches, branchIdx, t));
            edges.push([prev, idx]);
            idxs.push(idx);
            prev = idx;
        });
        return idxs;
    });

    for (let level = 0; level < 3; level++) {
        const [a, b, c] = [prongNodeIdx[0][level], prongNodeIdx[1][level], prongNodeIdx[2][level]];
        edges.push([a, b], [b, c], [c, a]);
    }

    const adjacency: number[][] = nodePositions.map(() => []);
    edges.forEach(([a, b], edgeIdx) => {
        adjacency[a].push(edgeIdx);
        adjacency[b].push(edgeIdx);
    });

    return { nodePositions, edges, adjacency };
}

interface WebParticle {
    fromNode: number;
    toNode: number;
    t: number;
}

/**
 * One icon's connection into the brain has two parts:
 *
 * 1. A STATIC web (see buildWebGraph) — converged at the icon, spreading
 *    out into a mesh as it nears the brain. Built once from `outer`/
 *    `branches` and never repositioned; only its vertex colors (a dim,
 *    always-on living-swirl tint) and its haze animate. An earlier
 *    version tied the web's own positions to the drifting ambient
 *    particles instead, which occasionally jumped or read as
 *    disconnected — a fixed web can't do either.
 *
 * 2. Particles that travel ALONG that web's actual edges — never off of
 *    it — each doing its own random walk across the web's graph: when a
 *    particle reaches a node, it picks a random edge touching that node
 *    (the SAME edge to bounce back the way it came, or a different one
 *    at a junction) and continues seamlessly from that exact point, so
 *    there's never a jump. On hover, a second bright copy of these same
 *    particle positions is shown (added to GlowLayer's bloom selection)
 *    — per explicit request, hover lights up the PARTICLES, not a line.
 */
function IconEnergyLink({ active, outer, branchIndices, onHoverPointsReady }: IconEnergyLinkProps) {
    const branches = useMemo<[number, number, number][]>(
        () => branchIndices.map((idx) => [brainNodes3D[idx * 3], brainNodes3D[idx * 3 + 1], brainNodes3D[idx * 3 + 2]]),
        [branchIndices],
    );

    const { nodePositions, edges, adjacency } = useMemo(() => buildWebGraph(outer, branches), [outer, branches]);

    // The static backbone's render buffers — position data is written
    // ONCE below (not in useFrame), only colors animate.
    const { webLinePositions, webGlowPositions, webHazePositions } = useMemo(() => {
        const lines: number[] = [];
        const glow: number[] = [];
        const haze: number[] = [];
        edges.forEach(([ai, bi]) => {
            const a = nodePositions[ai], b = nodePositions[bi];
            lines.push(...a, ...b);
            for (let s = 0; s < WEB_GLOW_SAMPLES_PER_EDGE; s++) {
                const et = s / (WEB_GLOW_SAMPLES_PER_EDGE - 1);
                glow.push(a[0] + (b[0] - a[0]) * et, a[1] + (b[1] - a[1]) * et, a[2] + (b[2] - a[2]) * et);
            }
            haze.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        });
        return {
            webLinePositions: new Float32Array(lines),
            webGlowPositions: new Float32Array(glow),
            webHazePositions: new Float32Array(haze),
        };
    }, [edges, nodePositions]);

    const webLineColors = useMemo(() => new Float32Array(webLinePositions.length), [webLinePositions]);
    const webLineRef = useRef<LineSegments>(null);
    const webGlowColors = useMemo(() => new Float32Array(webGlowPositions.length), [webGlowPositions]);
    const webGlowRef = useRef<ThreePoints>(null);
    const webHazeColors = useMemo(() => new Float32Array(webHazePositions.length), [webHazePositions]);
    const webHazeRef = useRef<ThreePoints>(null);

    // Each particle's own random walk state — lazily seeded once (a
    // fresh random edge/direction/progress per particle) on the first
    // useFrame call, then only ever mutated in place after that. Seeded
    // there rather than during render since Math.random is impure.
    const particlesRef = useRef<WebParticle[] | null>(null);

    const ambientPoints = useMemo(() => {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(AMBIENT_PARTICLES * 3), 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(AMBIENT_PARTICLES * 3), 3));
        const material = new PointsMaterial({
            vertexColors: true,
            map: getDotTexture(),
            alphaTest: 0.05,
            size: 0.04,
            sizeAttenuation: true,
            transparent: true,
            depthWrite: false,
        });
        return [new ThreePoints(geometry, material)];
    }, []);

    // The hover-only bright twin of the particles above — same live
    // positions, mirrored each frame, just full brightness and only
    // visible while active. Wrapped in a 1-element array — mutating the
    // raw useMemo result directly trips the react-hooks/immutability
    // rule.
    const hoverGlowPoints = useMemo(() => {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(AMBIENT_PARTICLES * 3), 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(AMBIENT_PARTICLES * 3), 3));
        const material = new PointsMaterial({
            vertexColors: true,
            map: getDotTexture(),
            alphaTest: 0.05,
            size: 0.06,
            sizeAttenuation: true,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
        });
        return [new ThreePoints(geometry, material)];
    }, []);

    useEffect(() => {
        hoverGlowPoints.forEach((p) => onHoverPointsReady?.(p));
    }, [hoverGlowPoints, onHoverPointsReady]);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;

        // Lazily seeded once, here rather than during render, since
        // Math.random is impure — then only ever mutated in place below.
        if (!particlesRef.current) {
            particlesRef.current = Array.from({ length: AMBIENT_PARTICLES }, () => {
                const edgeIdx = Math.floor(Math.random() * edges.length);
                const [a, b] = edges[edgeIdx];
                const forward = Math.random() < 0.5;
                return { fromNode: forward ? a : b, toNode: forward ? b : a, t: Math.random() };
            });
        }

        // The static web's colors — a dim, always-on living-swirl tint.
        // Never brightened on hover — per explicit request, hover only
        // affects the particles now, not the web itself.
        const webLineColAttr = webLineRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (webLineColAttr) {
            for (let n = 0; n < webLinePositions.length / 3; n++) {
                const x = webLinePositions[n * 3], y = webLinePositions[n * 3 + 1], z = webLinePositions[n * 3 + 2];
                const local = brainSwirlColor(x, y, z, time);
                const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                const boost = 0.45 / maxChannel;
                webLineColAttr.setXYZ(n, local[0] * boost, local[1] * boost, local[2] * boost);
            }
            webLineColAttr.needsUpdate = true;
        }
        const webGlowColAttr = webGlowRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (webGlowColAttr) {
            for (let n = 0; n < webGlowPositions.length / 3; n++) {
                const x = webGlowPositions[n * 3], y = webGlowPositions[n * 3 + 1], z = webGlowPositions[n * 3 + 2];
                const local = brainSwirlColor(x, y, z, time);
                const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                const boost = 0.5 / maxChannel;
                webGlowColAttr.setXYZ(n, local[0] * boost, local[1] * boost, local[2] * boost);
            }
            webGlowColAttr.needsUpdate = true;
        }
        const webHazeColAttr = webHazeRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (webHazeColAttr) {
            for (let n = 0; n < webHazePositions.length / 3; n++) {
                const x = webHazePositions[n * 3], y = webHazePositions[n * 3 + 1], z = webHazePositions[n * 3 + 2];
                const local = brainSwirlColor(x, y, z, time);
                const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                const boost = 1 / maxChannel; // value-boost normalized — WEB_HAZE_OPACITY carries the actual intensity
                webHazeColAttr.setXYZ(n, local[0] * boost, local[1] * boost, local[2] * boost);
            }
            webHazeColAttr.needsUpdate = true;
        }

        // Advance each particle along its current edge; on reaching the
        // node at the far end, pick a random edge touching that node
        // (any of them, including the one it just arrived on — a
        // legitimate reversal, giving the "back and forth" wandering
        // look) and continue from there. Position is always exactly on
        // an edge between two real web nodes, so it never jumps.
        const particles = particlesRef.current!;
        particles.forEach((p) => {
            p.t += delta * PARTICLE_EDGE_SPEED;
            while (p.t >= 1) {
                p.t -= 1;
                const arrived = p.toNode;
                const candidates = adjacency[arrived];
                const nextEdgeIdx = candidates[Math.floor(Math.random() * candidates.length)];
                const [a, b] = edges[nextEdgeIdx];
                p.fromNode = arrived;
                p.toNode = a === arrived ? b : a;
            }
        });

        ambientPoints.forEach((pts) => {
            const posAttr = pts.geometry.attributes.position as BufferAttribute;
            const colAttr = pts.geometry.attributes.color as BufferAttribute;
            particles.forEach((p, i) => {
                const from = nodePositions[p.fromNode];
                const to = nodePositions[p.toNode];
                const x = from[0] + (to[0] - from[0]) * p.t;
                const y = from[1] + (to[1] - from[1]) * p.t;
                const z = from[2] + (to[2] - from[2]) * p.t;
                posAttr.setXYZ(i, x, y, z);

                const local = brainSwirlColor(x, y, z, time);
                const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                const dimBoost = 0.7 / maxChannel;
                colAttr.setXYZ(i, local[0] * dimBoost, local[1] * dimBoost, local[2] * dimBoost);
            });
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
        });

        hoverGlowPoints.forEach((pts) => {
            pts.visible = active;
            if (!active) return;
            const posAttr = pts.geometry.attributes.position as BufferAttribute;
            const colAttr = pts.geometry.attributes.color as BufferAttribute;
            particles.forEach((p, i) => {
                const from = nodePositions[p.fromNode];
                const to = nodePositions[p.toNode];
                const x = from[0] + (to[0] - from[0]) * p.t;
                const y = from[1] + (to[1] - from[1]) * p.t;
                const z = from[2] + (to[2] - from[2]) * p.t;
                posAttr.setXYZ(i, x, y, z);

                const local = brainSwirlColor(x, y, z, time);
                const maxChannel = Math.max(local[0], local[1], local[2], 0.001);
                const brightBoost = 1 / maxChannel;
                colAttr.setXYZ(i, local[0] * brightBoost, local[1] * brightBoost, local[2] * brightBoost);
            });
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
            {hoverGlowPoints.map((p, i) => (
                <primitive key={`hg${i}`} object={p} />
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
    // All 10 icons' hover-glow Points objects, reported once fully
    // collected — see IconEnergyLink's onHoverPointsReady doc.
    onHoverPointsReady?: (points: ThreePoints[]) => void;
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

export default function OrbitRing3D({ onHoverPointsReady, onModuleClick, activeModuleId }: OrbitRing3DProps) {
    const positioned = useMemo(() => layoutModules(), []);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const collectedHoverPoints = useRef<ThreePoints[]>([]);

    const handleHoverPointsReady = (points: ThreePoints) => {
        collectedHoverPoints.current.push(points);
        // 1 hover-glow Points object per icon — see IconEnergyLink.
        if (collectedHoverPoints.current.length === positioned.length) {
            onHoverPointsReady?.(collectedHoverPoints.current);
        }
    };

    return (
        <group>

            <RingConnections positioned={positioned} />

            {positioned.map(({ module, outer, branchIndices }) => (
                <IconEnergyLink
                    key={module.id}
                    active={hoveredId === module.id || activeModuleId === module.id}
                    outer={outer}
                    branchIndices={branchIndices}
                    onHoverPointsReady={handleHoverPointsReady}
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
