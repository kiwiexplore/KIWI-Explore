import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
    BufferGeometry,
    BufferAttribute,
    Line as ThreeLine,
    LineBasicMaterial,
    Mesh,
} from "three";
import { brainNodes3D, brainEdges3D } from "../../state/neuralNetwork3D";

const PULSE_COUNT = 7;
const PATH_LENGTH = 7; // nodes per traveler — spans several hops, not just one edge
const DURATION = 1.1; // seconds to sweep the whole path
const JITTER = 0.012; // small per-frame position wobble for an "electric arc" flicker

const DIM_COLOR = { r: 0.05, g: 0.14, b: 0.32 };
const BRIGHT_COLOR = { r: 0.85, g: 0.96, b: 1.0 };

/**
 * NOTE ON <line> vs THREE.Line:
 * The JSX tag <line> collides with the DOM's built-in SVG <line> element
 * in TypeScript's types, which breaks the ref callback's type no matter
 * how it's annotated. Sidestepped entirely by constructing real
 * THREE.Line objects imperatively (useMemo) and mounting them via
 * <primitive object={...} />, which has no such name collision.
 */

function buildAdjacency(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    brainEdges3D.forEach(([a, b]) => {
        if (!map.has(a)) map.set(a, []);
        if (!map.has(b)) map.set(b, []);
        map.get(a)!.push(b);
        map.get(b)!.push(a);
    });
    return map;
}

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
 * neurons (not just one edge) — a lit window slides along a fixed
 * multi-hop path, bright head + fading tail, plus a tiny per-frame
 * position jitter so it reads as an electric impulse firing across
 * synapses rather than a smooth glide.
 */
export default function EnergyLayer() {
    const adjacency = useMemo(() => buildAdjacency(), []);

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

    const heads = useRef<(Mesh | null)[]>([]);

    useFrame((_state, delta) => {
        travelers.current.forEach((tr, i) => {
            tr.elapsed += delta;

            let progress = tr.elapsed / DURATION;
            if (progress < 0) {
                lines[i].visible = false;
                if (heads.current[i]) heads.current[i]!.visible = false;
                return;
            }
            if (progress >= 1) {
                travelers.current[i] = { path: randomWalk(adjacency), elapsed: 0 };
                progress = 0;
            }

            const posAttr = lines[i].geometry.attributes.position as BufferAttribute;
            const colAttr = lines[i].geometry.attributes.color as BufferAttribute;
            const path = travelers.current[i].path;

            let headX = 0, headY = 0, headZ = 0;

            for (let n = 0; n < PATH_LENGTH; n++) {
                const nodeIdx = path[n];
                const bx = brainNodes3D[nodeIdx * 3];
                const by = brainNodes3D[nodeIdx * 3 + 1];
                const bz = brainNodes3D[nodeIdx * 3 + 2];

                const jx = (Math.random() - 0.5) * JITTER;
                const jy = (Math.random() - 0.5) * JITTER;
                const jz = (Math.random() - 0.5) * JITTER;

                posAttr.setXYZ(n, bx + jx, by + jy, bz + jz);

                const t = n / (PATH_LENGTH - 1);
                const dist = Math.abs(t - progress);
                const brightness = Math.max(0, 1 - dist * 3.4);

                colAttr.setXYZ(
                    n,
                    DIM_COLOR.r + (BRIGHT_COLOR.r - DIM_COLOR.r) * brightness,
                    DIM_COLOR.g + (BRIGHT_COLOR.g - DIM_COLOR.g) * brightness,
                    DIM_COLOR.b + (BRIGHT_COLOR.b - DIM_COLOR.b) * brightness,
                );

                if (brightness > 0.9) {
                    headX = bx; headY = by; headZ = bz;
                }
            }

            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
            lines[i].visible = true;

            const head = heads.current[i];
            if (head) {
                head.visible = true;
                head.position.set(headX, headY, headZ);
            }
        });
    });

    return (
        <group>
            {lines.map((line, i) => (
                <primitive key={i} object={line} />
            ))}
            {Array.from({ length: PULSE_COUNT }).map((_, i) => (
                <mesh key={i} ref={(el) => { heads.current[i] = el; }}>
                    <sphereGeometry args={[0.024, 6, 6]} />
                    <meshBasicMaterial color="#eaf6ff" transparent opacity={0.95} />
                </mesh>
            ))}
        </group>
    );
}