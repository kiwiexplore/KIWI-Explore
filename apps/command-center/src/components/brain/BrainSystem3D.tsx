import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group, Line } from "three";
import NeuronLayer from "./NeuronLayer";
import ConnectionLayer from "./ConnectionLayer";
import EnergyLayer from "./EnergyLayer";
import BrainHaze from "./BrainHaze";

const DRAG_SPEED = 0.006;

interface BrainSystemProps {
    // Forwarded straight to EnergyLayer — see its own prop doc. Threaded
    // through here because GlowLayer (which needs these objects for
    // SelectiveBloom) is a sibling of this whole group, not a descendant.
    onPulseReady?: (lines: Line[]) => void;
    // True while Hey Kiwi is actively listening — pauses the idle
    // auto-rotation (same as an active drag), reading as the brain
    // "paying attention" instead of continuing to idly spin while the
    // user is mid-sentence. Resumes the moment listening stops. See
    // BrainScene3D, which lifts VoiceBar's own `listening` state up to
    // here (and to GlowLayer, for the matching glow boost).
    listening?: boolean;
}

/**
 * Combines the three Brain layers (neurons, connections, energy impulses)
 * into one rotating, breathing group. GlowLayer is deliberately NOT
 * included here — bloom is a postprocessing pass on the whole Canvas,
 * not something that belongs inside an individual object's group, so it
 * lives as a sibling in BrainScene3D instead.
 *
 * This group is the only thing that spins — the camera (OrbitControls
 * has rotate disabled) and the orbiting module icons around it stay put.
 * Dragging directly on the brain manually rotates it left/right only
 * (via the invisible hit-sphere below, which gives a generous,
 * easy-to-grab hit area) — no vertical tilt, so it never flips upside
 * down or shows an odd top-down angle. Idle auto-rotation resumes once
 * the drag ends.
 */
export default function BrainSystem({ onPulseReady, listening }: BrainSystemProps) {
    const groupRef = useRef<Group>(null);
    const dragging = useRef(false);
    const lastPointer = useRef({ x: 0, y: 0 });

    useFrame((state, delta) => {
        if (groupRef.current) {
            if (!dragging.current && !listening) {
                groupRef.current.rotation.y += delta * 0.09;
            }
            const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
            groupRef.current.scale.setScalar(breathe);
        }
    });

    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        (event.target as Element).setPointerCapture(event.pointerId);
        dragging.current = true;
        lastPointer.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
        if (!dragging.current || !groupRef.current) return;
        const dx = event.clientX - lastPointer.current.x;
        lastPointer.current = { x: event.clientX, y: event.clientY };

        groupRef.current.rotation.y += dx * DRAG_SPEED;
    };

    const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
        dragging.current = false;
        (event.target as Element).releasePointerCapture(event.pointerId);
    };

    return (
        <group ref={groupRef}>
            <BrainHaze />
            <ConnectionLayer />
            <NeuronLayer />
            <EnergyLayer onReady={onPulseReady} />
            <mesh
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <sphereGeometry args={[1.1, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
        </group>
    );
}
