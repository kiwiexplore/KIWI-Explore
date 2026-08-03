import { brainNodes3D } from "../../state/neuralNetwork3D";

const NODE_COUNT = brainNodes3D.length / 3;

/**
 * Shared per-node RGB overlay written by EnergyLayer every frame (reset
 * to 0, then the current bright color of each traveler is written at the
 * node positions its pulse is currently lighting) and read by NeuronLayer
 * every frame (added on top of each dot's ambient swirl color).
 *
 * A plain module-level array rather than React context/prop-drilling —
 * there is only ever one Brain instance in this app, and this is a
 * per-frame imperative write/read (not something React's render cycle
 * needs to know about), so a shared mutable buffer is the simplest fit.
 * NeuronLayer's useFrame runs before EnergyLayer's (mount order), so
 * reads are one frame behind writes — imperceptible at animation speed.
 */
export const pulseBoost = new Float32Array(NODE_COUNT * 3);
