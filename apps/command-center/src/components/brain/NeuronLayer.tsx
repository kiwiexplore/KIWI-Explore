import { useMemo } from "react";
import { brainNodes3D, brainColors3D } from "../../state/neuralNetwork3D";

/**
 * Renders only the neuron particles — no connections, no energy, no glow
 * setup. Deliberately narrow responsibility (per the layered architecture:
 * BrainSystem composes this with ConnectionLayer/EnergyLayer/GlowLayer).
 *
 * Uses raw <points>/<bufferGeometry>/<pointsMaterial> rather than a
 * higher-level drei wrapper — this is the pattern already proven to
 * reliably carry per-vertex colors in this codebase.
 */
export default function NeuronLayer() {
    const positions = useMemo(() => new Float32Array(brainNodes3D), []);
    const colors = useMemo(() => new Float32Array(brainColors3D), []);

    return (
        <points>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial
                vertexColors
                size={0.019}
                sizeAttenuation
                transparent
                depthWrite={false}
            />
        </points>
    );
}