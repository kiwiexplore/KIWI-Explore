import { useMemo } from "react";
import { brainConnectionSegments } from "../../state/neuralNetwork3D";

/**
 * Renders the neural connections — each one pre-baked as a bent 3-point
 * polyline (see state/neuralNetwork3D.ts), not a straight line, so the
 * network doesn't read as a geometric wireframe/triangulation. Flattened
 * into a single LineSegments buffer (one draw call for ~6,400 segments)
 * rather than one <line> per connection, which would be far more
 * expensive and also hit the <line>-vs-SVGLineElement JSX typing
 * collision documented in EnergyLayer.tsx.
 */
export default function ConnectionLayer() {
    const positions = useMemo(() => {
        const arr = new Float32Array(brainConnectionSegments.length * 12);

        brainConnectionSegments.forEach((seg, i) => {
            // seg = [ax,ay,az, mx,my,mz, bx,by,bz] -> two segments: a-m, m-b
            arr.set(
                [
                    seg[0], seg[1], seg[2], seg[3], seg[4], seg[5],
                    seg[3], seg[4], seg[5], seg[6], seg[7], seg[8],
                ],
                i * 12,
            );
        });

        return arr;
    }, []);

    return (
        <lineSegments>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#49C7FF" transparent opacity={0.16} />
        </lineSegments>
    );
}