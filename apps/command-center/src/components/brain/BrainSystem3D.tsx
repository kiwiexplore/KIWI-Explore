import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import NeuronLayer from "./NeuronLayer";
import ConnectionLayer from "./ConnectionLayer";
import EnergyLayer from "./EnergyLayer";

/**
 * Combines the three Brain layers (neurons, connections, energy impulses)
 * into one rotating, breathing group. GlowLayer is deliberately NOT
 * included here — bloom is a postprocessing pass on the whole Canvas,
 * not something that belongs inside an individual object's group, so it
 * lives as a sibling in BrainScene3D instead.
 *
 * This group is the only thing that spins — the camera (OrbitControls)
 * and the orbiting module icons around it stay put unless the person
 * drags to look around.
 */
export default function BrainSystem() {
    const groupRef = useRef<Group>(null);

    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.15;
            const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
            groupRef.current.scale.setScalar(breathe);
        }
    });

    return (
        <group ref={groupRef}>
            <ConnectionLayer />
            <NeuronLayer />
            <EnergyLayer />
        </group>
    );
}