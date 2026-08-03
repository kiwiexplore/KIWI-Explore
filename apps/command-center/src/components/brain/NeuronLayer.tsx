import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { BufferAttribute, Points } from "three";
import { brainNodes3D } from "../../state/neuralNetwork3D";
import { brainSwirlColor } from "./brainColor";
import { pulseBoost } from "./pulseField";
import { KEPT_NODE_INDICES } from "./keptNodes";
import { getDotTexture } from "./dotTexture";

// Deterministic hash (not Math.random — must stay pure since this runs
// inside a useMemo initializer during render) used for per-node
// brightness variance and rare hotspots.
function hash(i: number): number {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * Renders only the neuron particles — no connections, no energy, no glow
 * setup. Deliberately narrow responsibility (per the layered architecture:
 * BrainSystem composes this with ConnectionLayer/EnergyLayer/GlowLayer).
 *
 * Colors come from the shared brainSwirlColor() field (position + a slow
 * time phase) — same function EnergyLayer uses for its pulses, so the
 * whole brain reads as one living color field instead of neurons and
 * pulses looking like two unrelated layers. On top of that, pulseBoost
 * (written every frame by EnergyLayer) is added in — this is what makes
 * the dots a given pulse has swept over visibly light up in that pulse's
 * own color, independently per pulse.
 *
 * Uses raw <points>/<bufferGeometry>/<pointsMaterial> rather than a
 * higher-level drei wrapper — this is the pattern already proven to
 * reliably carry per-vertex colors in this codebase.
 */
export default function NeuronLayer() {
    // Original node indices kept for this thinned point cloud — shared
    // with ConnectionLayer (via keptNodes.ts) so a connection never
    // dangles off to a node that has no visible dot here.
    const keptIndices = KEPT_NODE_INDICES;
    const nodeCount = keptIndices.length;

    const positions = useMemo(() => {
        const arr = new Float32Array(nodeCount * 3);
        keptIndices.forEach((idx, n) => {
            arr[n * 3] = brainNodes3D[idx * 3];
            arr[n * 3 + 1] = brainNodes3D[idx * 3 + 1];
            arr[n * 3 + 2] = brainNodes3D[idx * 3 + 2];
        });
        return arr;
    }, [keptIndices, nodeCount]);

    // Per-node variance/hotspot factors are static — only the underlying
    // swirl color animates — so these are computed once.
    const variance = useMemo(() => {
        const arr = new Float32Array(nodeCount);
        keptIndices.forEach((idx, n) => {
            const isHotspot = hash(idx * 7.13) > 0.985;
            arr[n] = (0.85 + hash(idx) * 0.3) * (isHotspot ? 1.6 : 1);
        });
        return arr;
    }, [keptIndices, nodeCount]);

    const colors = useMemo(() => new Float32Array(nodeCount * 3), [nodeCount]);
    const pointsRef = useRef<Points>(null);

    useFrame((state) => {
        const attr = pointsRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (!attr) return;
        const time = state.clock.elapsedTime;

        for (let n = 0; n < nodeCount; n++) {
            const x = positions[n * 3];
            const y = positions[n * 3 + 1];
            const z = positions[n * 3 + 2];

            const base = brainSwirlColor(x, y, z, time);
            const v = variance[n];
            const boostIdx = keptIndices[n] * 3;

            attr.setXYZ(
                n,
                Math.min(1, base[0] * v + pulseBoost[boostIdx]),
                Math.min(1, base[1] * v + pulseBoost[boostIdx + 1]),
                Math.min(1, base[2] * v + pulseBoost[boostIdx + 2]),
            );
        }

        attr.needsUpdate = true;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial
                vertexColors
                map={getDotTexture()}
                alphaTest={0.05}
                size={0.026}
                sizeAttenuation
                transparent
                depthWrite={false}
            />
        </points>
    );
}
