import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
    BufferGeometry,
    BufferAttribute,
    Line as ThreeLine,
    LineBasicMaterial,
} from "three";
import { brainNodes3D } from "../../state/neuralNetwork3D";
import { brainSwirlColor } from "./brainColor";
import { pulseBoost } from "./pulseField";
import { brainAdjacency } from "./brainTopology";
import { findBrainRegion } from "../../state/brainRegions";

const PULSE_COUNT = 6;
// Nodes per traveler: a long route across many hops, so a pulse crosses
// a real stretch of the brain rather than blipping between neighbours.
const PATH_LENGTH = 96;
// One run down a route, then straight into a fresh route from somewhere
// else entirely. There's no pause between them any more (per explicit
// request): the comet's own tail is still fading out of the end of one
// route while its head sets off down the next, so the brain always has
// something moving through it.
const TRAVEL_DURATION = 5.4;

// Comet shape: a soft leading edge and a SHARP cutoff behind it, rather
// than a long fading tail. Evaluated per node against that node's own
// position along the route (0 = start, 1 = end) as `progress` sweeps
// 0→1, so the same formula produces a narrow wavefront running along
// the path and switching each node off again right after it passes.
function cometBrightness(nodeT: number, progress: number): number {
    const signedDist = nodeT - progress;
    const raw = signedDist > 0 ? Math.max(0, 1 - signedDist * 6) : Math.max(0, 1 + signedDist * 9);
    return raw * raw * (3 - 2 * raw);
}

/**
 * NOTE ON <line> vs THREE.Line:
 * The JSX tag <line> collides with the DOM's built-in SVG <line> element
 * in TypeScript's types, which breaks the ref callback's type no matter
 * how it's annotated. Sidestepped entirely by constructing real
 * THREE.Line objects imperatively (useMemo) and mounting them via
 * <primitive object={...} />, which has no such name collision.
 */

/**
 * A node to start a route from. With a region open the camera is deep
 * inside that area and sees only a slice of the brain, so a route
 * starting anywhere at random would almost always run past unseen: the
 * pulses would be there but invisible. Starting them inside the region
 * you're actually in puts them in front of you (they still wander out of
 * it as the walk goes on, which is the point — the signal is going
 * somewhere).
 */
function startNode(focusRegionId: string | null): number {
    const nodeCount = brainNodes3D.length / 3;
    const region = findBrainRegion(focusRegionId);
    if (!region) return Math.floor(Math.random() * nodeCount);

    // Rejection sampling rather than a prebuilt per-region node list:
    // a region covers a good fraction of the brain, so this lands inside
    // it within a few tries, and it stays correct if anchors move.
    for (let attempt = 0; attempt < 40; attempt++) {
        const candidate = Math.floor(Math.random() * nodeCount);
        const dx = brainNodes3D[candidate * 3] - region.anchor[0];
        const dy = brainNodes3D[candidate * 3 + 1] - region.anchor[1];
        const dz = brainNodes3D[candidate * 3 + 2] - region.anchor[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= region.radius) return candidate;
    }
    return Math.floor(Math.random() * nodeCount);
}

function randomWalk(adjacency: Map<number, number[]>, focusRegionId: string | null): number[] {
    let current = startNode(focusRegionId);
    const path = [current];

    for (let i = 0; i < PATH_LENGTH - 1; i++) {
        const neighbors = adjacency.get(current);
        if (!neighbors || neighbors.length === 0) break;
        current = neighbors[Math.floor(Math.random() * neighbors.length)];
        path.push(current);
    }
    while (path.length < PATH_LENGTH) path.push(path[path.length - 1]);

    return path;
}

interface Traveler {
    path: number[];
    elapsed: number;
}

/**
 * Pulses that run across the brain: each one a comet-shaped wavefront
 * travelling a long random walk of connected neurons, lighting each node
 * as it arrives and switching it off again as it leaves. Reaching the
 * end of its route, a pulse picks a brand new one starting somewhere
 * else in the brain and continues into it without a break — several of
 * them at once, staggered, so the brain always has something running
 * through it.
 *
 * This is deliberately the same effect the orbiting module icons used to
 * fire down their link into the brain (travel, switch off on arrival,
 * repeat after a beat), brought inside the brain itself per explicit
 * request. It replaced a version that slid a long fading tail along a
 * path over 12 seconds with a fade-in/out envelope: that read as ambient
 * drifting glow, not as a signal going somewhere.
 *
 * There's no separate glowing marker mesh sitting on top of nodes — but
 * the actual neuron dots (rendered by NeuronLayer) DO light up as this
 * pulse passes through them, via the shared pulseField module: each node
 * currently under the comet gets this pulse's own current color written
 * into pulseBoost, which NeuronLayer adds on top of its ambient swirl
 * color. Multiple pulses can light the same node independently — the
 * brightest contribution per channel wins rather than summing, so
 * overlaps don't blow out to white.
 *
 * Pulse color is NOT a fixed white/blue — each vertex samples the same
 * brainSwirlColor() field NeuronLayer uses at that position, so a pulse
 * always glows in whatever hue the neurons around it currently are. That
 * makes pulses read as energy moving through the brain's own living
 * color field rather than a separate effect laid on top of it.
 */
interface EnergyLayerProps {
    // Hands the traveler Line objects up to the parent once, so GlowLayer's
    // SelectiveBloom can target exactly these objects — bloom should only
    // ever appear where a pulse is passing, never on the ambient network.
    onReady?: (lines: ThreeLine[]) => void;
    // The region currently open, if any — new routes then start inside
    // it, so the pulses are visible from in there rather than running
    // somewhere off screen (see startNode).
    focusRegionId?: string | null;
}

export default function EnergyLayer({ onReady, focusRegionId = null }: EnergyLayerProps) {
    const adjacency = brainAdjacency;

    const travelers = useRef<Traveler[]>([]);
    // Mirrored into a ref inside an effect (not during render) purely so
    // useFrame can read the latest value when a route ends: the change
    // takes effect on the NEXT route rather than restarting travelers
    // mid-flight.
    const focusRef = useRef(focusRegionId);
    useEffect(() => {
        focusRef.current = focusRegionId;
    }, [focusRegionId]);

    // Random initial staggering/paths happen here (post-render), not in the
    // component body, since calling Math.random() synchronously during
    // render trips the "must be pure" lint rule. The negative start is
    // the stagger: every traveler begins mid-pause, at its own offset,
    // so they never set off in formation.
    useEffect(() => {
        travelers.current = Array.from({ length: PULSE_COUNT }, () => ({
            path: randomWalk(adjacency, null),
            // Staggered starts, spread across one full run, so the
            // travellers never set off together.
            elapsed: -Math.random() * TRAVEL_DURATION,
        }));
    }, [adjacency]);

    const lines = useMemo(
        () =>
            Array.from({ length: PULSE_COUNT }, () => {
                const geometry = new BufferGeometry();
                geometry.setAttribute("position", new BufferAttribute(new Float32Array(PATH_LENGTH * 3), 3));
                geometry.setAttribute("color", new BufferAttribute(new Float32Array(PATH_LENGTH * 3), 3));
                const material = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
                return new ThreeLine(geometry, material);
            }),
        [],
    );

    useEffect(() => {
        onReady?.(lines);
    }, [lines, onReady]);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;
        pulseBoost.fill(0);

        travelers.current.forEach((tr, i) => {
            tr.elapsed += delta;

            // At the end of a run it picks a new route immediately and
            // carries the overshoot into it, so the head sets off down
            // the new path in the same frame the old one finished —
            // continuous motion rather than a gap.
            if (tr.elapsed >= TRAVEL_DURATION) {
                travelers.current[i] = {
                    path: randomWalk(adjacency, focusRef.current),
                    elapsed: tr.elapsed - TRAVEL_DURATION,
                };
            }
            if (travelers.current[i].elapsed < 0) {
                lines[i].visible = false;
                return;
            }

            const progress = travelers.current[i].elapsed / TRAVEL_DURATION;

            const posAttr = lines[i].geometry.attributes.position as BufferAttribute;
            const colAttr = lines[i].geometry.attributes.color as BufferAttribute;
            const path = travelers.current[i].path;

            for (let n = 0; n < PATH_LENGTH; n++) {
                const nodeIdx = path[n];
                const bx = brainNodes3D[nodeIdx * 3];
                const by = brainNodes3D[nodeIdx * 3 + 1];
                const bz = brainNodes3D[nodeIdx * 3 + 2];

                posAttr.setXYZ(n, bx, by, bz);

                const brightness = cometBrightness(n / (PATH_LENGTH - 1), progress);

                // Dim and bright ends are both derived from the same local
                // hue, so the pulse's own colors stay in the same family as
                // the neurons it's passing through. The bright end scales
                // the hue up so its strongest channel reaches ~1 (a "value"
                // boost, HSV-style) rather than adding flat white toward the
                // bright end — additive white was washing every hue toward
                // the same pale cyan, which is why pulses all looked the
                // same regardless of the local color underneath them.
                const local = brainSwirlColor(bx, by, bz, time);
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

                // Also light up the actual neuron dot at this node (not
                // just this floating comet line) — several pulses can
                // overlap the same node, so this takes the brightest
                // contribution per channel rather than summing (which
                // would blow out to white where pulses cross).
                const boostIdx = nodeIdx * 3;
                pulseBoost[boostIdx] = Math.max(pulseBoost[boostIdx], cr);
                pulseBoost[boostIdx + 1] = Math.max(pulseBoost[boostIdx + 1], cg);
                pulseBoost[boostIdx + 2] = Math.max(pulseBoost[boostIdx + 2], cb);
            }

            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
            lines[i].visible = true;
        });
    });

    return (
        <group>
            {lines.map((line, i) => (
                <primitive key={i} object={line} />
            ))}
        </group>
    );
}