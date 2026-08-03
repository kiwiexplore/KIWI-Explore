import { connectionPositions } from "./connectionGeometry";

/**
 * Renders the neural connections — each one a bent 3-point polyline (see
 * state/neuralNetwork3D.ts), not a straight line, so the network doesn't
 * read as a geometric wireframe/triangulation. Flattened into a single
 * LineSegments buffer (one draw call) rather than one <line> per
 * connection, which would be far more expensive and also hit the
 * <line>-vs-SVGLineElement JSX typing collision documented in
 * EnergyLayer.tsx.
 *
 * The actual vertex data (baked + synthetic gap-fill + fissure seam) is
 * built once in connectionGeometry.ts, shared with BrainHaze so its glow
 * sprites can hug these exact same line vertices instead of the raw
 * neuron node positions. The fissure seam is just more of this same
 * buffer now (no separate re-render) — that's what makes it pick up
 * every rule everything else here does (including BrainHaze) without
 * anything fissure-specific to keep in sync.
 */
export default function ConnectionLayer() {
    return (
        <lineSegments>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[connectionPositions, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#6fd4ff" transparent opacity={0.39} />
        </lineSegments>
    );
}
