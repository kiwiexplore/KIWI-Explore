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
import { getDotTexture } from "./dotTexture";
import "./OrbitRing3D.css";

const RADIUS = 1.48;
const INNER_RADIUS = 0.65; // how deep into the brain's volume the connection reaches, not just its outer surface
const FORK_T = 0.6; // fraction of the journey that's a shared trunk before it splits into branches
const AMBIENT_PARTICLES = 9; // 3 per branch — the calm, always-on hint
const HOVER_PATH_LENGTH = 14; // brain nodes the hover pulse hops across, past the entry point
const DRIFT_SPEED = 0.16; // loops per second — slow, magical, not a fast dash
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

function layoutModules(): Positioned[] {
    const n = orbitModules.length;
    const step = (2 * Math.PI) / n;

    return orbitModules.map((module, i) => {
        const angle = step * i - Math.PI / 2;
        // The ring reads as slightly egg-shaped rather than circular —
        // pull the bottom icons in a bit and push the top ones out a
        // touch to compensate, rather than a uniform radius.
        const yFactor = Math.sin(angle);
        const radiusScale = yFactor < 0 ? 1 + yFactor * 0.18 : 1 + yFactor * 0.06;
        const iconRadius = RADIUS * radiusScale;
        const outer: [number, number, number] = [Math.cos(angle) * iconRadius, Math.sin(angle) * iconRadius, 0];
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

/**
 * One icon's connection into the brain has two parts:
 *
 * 1. A calm, always-on drift of ambient motes along a branching path: a
 *    shared trunk out from the icon, forking partway into three prongs,
 *    each reaching a different real, currently-visible brain node, like
 *    a lightning bolt forking near its end rather than a single wire.
 *
 * 2. On hover, ONE bright line — a single branch (not a fork), but built
 *    by threading through the CURRENT positions of ALL 9 ambient
 *    particles (forced onto branch 0's curve regardless of which prong
 *    they're each nominally drifting along, since that curve is
 *    identical for all of them up to the fork point anyway), read
 *    straight out of the same values ambientPoints is writing this frame
 *    — so the strand moves exactly as those particles drift and visibly
 *    threads through every one of them, not just a subset. Past the
 *    entry node it keeps going via a random walk across the brain's real
 *    graph adjacency (see brainTopology), nudging pulseBoost at each
 *    node it passes. Unlike EnergyLayer's internal pulses, this one does
 *    NOT fade in/out or travel as a comet — it just lights up at full
 *    brightness for as long as the icon is hovered, per feedback that a
 *    fade cycle read as "flickering" rather than a steady connection.
 */
function IconEnergyLink({ active, outer, branchIndices, seed, onHoverLineReady }: IconEnergyLinkProps) {
    const branches = useMemo<[number, number, number][]>(
        () => branchIndices.map((idx) => [brainNodes3D[idx * 3], brainNodes3D[idx * 3 + 1], brainNodes3D[idx * 3 + 2]]),
        [branchIndices],
    );
    const entryIdx = branchIndices[0];

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

    // Single strand: icon + all 9 ambient particles' live positions +
    // the graph-walk continuation past the entry node. Wrapped in a
    // 1-element array (not a bare object) so it can be mutated inside
    // useFrame via a .forEach callback parameter — mutating the raw
    // useMemo result directly trips the react-hooks/immutability rule.
    const hoverLines = useMemo(() => {
        const pointCount = 1 + AMBIENT_PARTICLES + HOVER_PATH_LENGTH;
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
        onHoverLineReady?.(hoverLines[0]);
    }, [hoverLines, onHoverLineReady]);

    // The graph-walk continuation's path (and its fade cycle) resets
    // once per hover — see the wasActive transition below.
    const traveler = useRef<{ path: number[]; elapsed: number }>({ path: [], elapsed: 0 });
    const wasActive = useRef(false);

    // Reused every frame for all 9 particles' live positions (forced onto
    // branch 0's curve — see doc comment) — declared outside useFrame so
    // it's not reallocated per frame.
    const particlesLive = useRef<{ t: number; x: number; y: number; z: number }[]>(
        Array.from({ length: AMBIENT_PARTICLES }, () => ({ t: 0, x: 0, y: 0, z: 0 })),
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

                // The hover line threads through this SAME particle, but
                // recomputed on branch 0's curve (identical to its own
                // curve up to the fork point regardless of which branch
                // it's nominally on) so every particle contributes a
                // point on the one single strand rather than only
                // branch 0's third of them.
                const [lx, ly, lz] = pointOnBranch(outer, branches, 0, t);
                particlesLive.current[i] = { t, x: lx + perpX * wobble, y: ly + perpY * wobble, z: lz };
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
        });
        particlesLive.current.sort((a, b) => a.t - b.t);

        if (active && !wasActive.current) {
            traveler.current = { path: randomWalk(entryIdx, HOVER_PATH_LENGTH), elapsed: 0 };
            wasActive.current = true;
        } else if (!active) {
            wasActive.current = false;
        }

        hoverLines.forEach((ln) => {
            ln.visible = active;
            if (!active) return;

            traveler.current.elapsed += delta;
            let pathProgress = traveler.current.elapsed / HOVER_DURATION;
            if (pathProgress >= 1) {
                traveler.current = { path: randomWalk(entryIdx, HOVER_PATH_LENGTH), elapsed: 0 };
                pathProgress = 0;
            }
            // Same fade-in/hold/fade-out envelope as EnergyLayer's
            // internal pulses — only the graph-walk continuation (past
            // the entry node) breathes with it; the trunk stays constant.
            const envelope = smoothstep(0, HOVER_FADE_IN, pathProgress) * (1 - smoothstep(1 - HOVER_FADE_OUT, 1, pathProgress));

            const path = traveler.current.path;
            const posAttr = ln.geometry.attributes.position as BufferAttribute;
            const colAttr = ln.geometry.attributes.color as BufferAttribute;
            const pointCount = 1 + AMBIENT_PARTICLES + HOVER_PATH_LENGTH;

            for (let n = 0; n < pointCount; n++) {
                let px: number, py: number, pz: number, nodeIdx = -1;
                let brightness = 1; // trunk (icon + particles): constant, no fade

                if (n === 0) {
                    // The icon itself — fixed anchor for the strand.
                    [px, py, pz] = outer;
                } else if (n <= AMBIENT_PARTICLES) {
                    const live = particlesLive.current[n - 1];
                    px = live.x; py = live.y; pz = live.z;
                } else {
                    const k = n - 1 - AMBIENT_PARTICLES;
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
        const pts: [number, number, number][] = [];
        for (let i = 0; i < positioned.length; i++) {
            const a = positioned[i].outer;
            const b = positioned[(i + 1) % positioned.length].outer;
            for (let s = 0; s < RING_SUBSEGMENTS; s++) {
                const t = s / RING_SUBSEGMENTS;
                pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
            }
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
}

export default function OrbitRing3D({ onHoverLinesReady }: OrbitRing3DProps) {
    const positioned = useMemo(() => layoutModules(), []);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const collectedHoverLines = useRef<ThreeLine[]>([]);

    const handleHoverLineReady = (line: ThreeLine) => {
        collectedHoverLines.current.push(line);
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
                    active={hoveredId === module.id}
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
