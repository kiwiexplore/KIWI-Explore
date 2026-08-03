import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type BufferAttribute, type Points } from "three";
import { brainSwirlColor } from "./brainColor";
import { connectionPositions } from "./connectionGeometry";
import { getHazeTexture } from "./dotTexture";

/**
 * A soft "space smoke" layer sampled from ALONG the actual rendered
 * CONNECTION lines (see connectionGeometry.ts), never at their
 * endpoints. Deliberately kept separate from GlowLayer's SelectiveBloom,
 * which stays reserved for actual energy pulses.
 *
 * Each connection in connectionPositions is baked as 4 points — A, M, M,
 * B (a real node, the bent curve's midpoint twice, another real node) —
 * because it's rendered as two LineSegments pairs (A-M, M-B). An earlier
 * version sampled fractions ALONG each of those two pairs (e.g. t=0.1,
 * t=0.9), reasoning that avoiding the exact t=0/t=1 endpoints would keep
 * samples off the nodes. That still read as "haze on the particles"
 * anyway: most connections here are SHORT, so even a point 10-13% of the
 * way along a short pair is still only a hair's width from the real
 * node at its other end — visually indistinguishable from sitting on
 * it. Sampling at the MIDPOINT of each pair instead (plus the curve's
 * own bow midpoint M) keeps every sample maximally far from both real
 * endpoints regardless of how short the connection is.
 *
 * Sprite SIZE has to stay small relative to the whole brain (roughly
 * line-thickness scale, not "big soft cloud" scale) — growing the
 * sprite size well past the brain's own ~2-unit diameter meant every
 * sprite blanketed almost the whole model regardless of which line
 * vertex it was centered on, reading as one giant color blob rather
 * than smoke hugging the wireframe. "Wider coverage" instead comes from
 * sampling more of the lines, not from inflating each sprite.
 */
export default function BrainHaze() {
    const positions = useMemo(() => {
        const connectionCount = connectionPositions.length / 12;
        const kept: number[] = [];
        for (let c = 0; c < connectionCount; c++) {
            const i = c * 12;
            const ax = connectionPositions[i], ay = connectionPositions[i + 1], az = connectionPositions[i + 2];
            const mx = connectionPositions[i + 3], my = connectionPositions[i + 4], mz = connectionPositions[i + 5];
            const bx = connectionPositions[i + 9], by = connectionPositions[i + 10], bz = connectionPositions[i + 11];

            // Midpoint of A->M, the bow midpoint M itself, midpoint of M->B.
            kept.push(
                (ax + mx) / 2, (ay + my) / 2, (az + mz) / 2,
                mx, my, mz,
                (mx + bx) / 2, (my + by) / 2, (mz + bz) / 2,
            );
        }
        return new Float32Array(kept);
    }, []);
    const pointCount = positions.length / 3;

    const colors = useMemo(() => new Float32Array(positions.length), [positions]);
    const pointsRef = useRef<Points>(null);

    useFrame((state) => {
        const attr = pointsRef.current?.geometry.attributes.color as BufferAttribute | undefined;
        if (!attr) return;
        const time = state.clock.elapsedTime;

        for (let n = 0; n < pointCount; n++) {
            const x = positions[n * 3], y = positions[n * 3 + 1], z = positions[n * 3 + 2];
            const base = brainSwirlColor(x, y, z, time);
            // brainSwirlColor's stops are NOT equal-brightness (cyan's raw
            // channel values are much larger than dark blue's), so using
            // it directly made the haze visibly brighter wherever the
            // swirl landed on cyan than wherever it landed on the dimmer
            // stops. Normalizing each sample's own peak channel to 1
            // (same "value boost" used for pulses elsewhere) keeps every
            // point the same brightness regardless of which hue it is.
            const maxChannel = Math.max(base[0], base[1], base[2], 0.001);
            const boost = 1 / maxChannel;
            attr.setXYZ(n, base[0] * boost, base[1] * boost, base[2] * boost);
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
                map={getHazeTexture()}
                size={0.17}
                sizeAttenuation
                transparent
                opacity={0.0672}
                depthWrite={false}
                blending={AdditiveBlending}
            />
        </points>
    );
}
