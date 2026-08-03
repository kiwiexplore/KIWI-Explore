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

const PULSE_COUNT = 7;
const PATH_LENGTH = 56; // nodes per traveler — long sweep across many hops, not a short blip
const DURATION = 12.5; // seconds to sweep the whole path — slow and deliberate
const FADE_IN = 0.18; // fraction of DURATION spent rising from nothing
const FADE_OUT = 0.32; // fraction of DURATION spent slowly dying back out

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/**
 * NOTE ON <line> vs THREE.Line:
 * The JSX tag <line> collides with the DOM's built-in SVG <line> element
 * in TypeScript's types, which breaks the ref callback's type no matter
 * how it's annotated. Sidestepped entirely by constructing real
 * THREE.Line objects imperatively (useMemo) and mounting them via
 * <primitive object={...} />, which has no such name collision.
 */

function randomWalk(adjacency: Map<number, number[]>): number[] {
    const nodeCount = brainNodes3D.length / 3;
    let current = Math.floor(Math.random() * nodeCount);
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
 * Sparks that travel across a short random walk of several connected
 * neurons (not just one edge) — a long, comet-shaped glow (bright leading
 * edge, gradually fading tail) slides along a fixed multi-hop path.
 * The whole traveler also fades in from nothing and slowly fades back
 * out (a smoothstep envelope on the line's opacity) rather than popping
 * in at full brightness and cutting off abruptly when it resets to a new
 * path — that abrupt cut plus per-frame position jitter was reading as
 * jerky/choppy rather than a smooth glow-up-and-fade.
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
}

export default function EnergyLayer({ onReady }: EnergyLayerProps) {
    const adjacency = brainAdjacency;

    const travelers = useRef<Traveler[]>([]);

    // Random initial staggering/paths happen here (post-render), not in the
    // component body, since calling Math.random() synchronously during
    // render trips the "must be pure" lint rule.
    useEffect(() => {
        travelers.current = Array.from({ length: PULSE_COUNT }, () => ({
            path: randomWalk(adjacency),
            elapsed: -Math.random() * 3,
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

            let progress = tr.elapsed / DURATION;
            if (progress < 0) {
                lines[i].visible = false;
                return;
            }
            if (progress >= 1) {
                travelers.current[i] = { path: randomWalk(adjacency), elapsed: 0 };
                progress = 0;
            }

            const posAttr = lines[i].geometry.attributes.position as BufferAttribute;
            const colAttr = lines[i].geometry.attributes.color as BufferAttribute;
            const path = travelers.current[i].path;

            // Overall envelope: fades in from 0, holds, then slowly fades
            // back to 0 — so the traveler never pops in/out and the reset
            // to a new random path happens while fully invisible.
            const envelope = smoothstep(0, FADE_IN, progress) * (1 - smoothstep(1 - FADE_OUT, 1, progress));

            for (let n = 0; n < PATH_LENGTH; n++) {
                const nodeIdx = path[n];
                const bx = brainNodes3D[nodeIdx * 3];
                const by = brainNodes3D[nodeIdx * 3 + 1];
                const bz = brainNodes3D[nodeIdx * 3 + 2];

                posAttr.setXYZ(n, bx, by, bz);

                // Comet shape: soft leading edge, long smoothly-fading tail
                // behind it — reads as one continuous pulse rather than a
                // point flashing at each node. Smoothstep-eased so the
                // brightness ramps in/out rather than falling off linearly.
                const t = n / (PATH_LENGTH - 1);
                const signedDist = t - progress;
                const rawBrightness =
                    signedDist > 0
                        ? Math.max(0, 1 - signedDist * 4)
                        : Math.max(0, 1 + signedDist * 0.5);
                const brightness = rawBrightness * rawBrightness * (3 - 2 * rawBrightness) * envelope;

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