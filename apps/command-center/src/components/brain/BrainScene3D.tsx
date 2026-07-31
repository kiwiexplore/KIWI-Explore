import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sparkles } from "@react-three/drei";
import BrainSystem3D from "./BrainSystem3D";
import GlowLayer from "./GlowLayer";
import OrbitRing3D from "./OrbitRing3D";

/**
 * Test harness for the 3D Brain — Canvas, camera, lights, ambient dust,
 * and the Brain itself (BrainSystem3D = NeuronLayer + ConnectionLayer +
 * EnergyLayer) plus GlowLayer (Bloom) and the orbiting module icons.
 *
 * OrbitControls has autoRotate OFF on purpose — only BrainSystem3D spins,
 * the camera/icons/connections stay put unless the person drags to look
 * around. Once this is dialed in it becomes the real thing; for now it's
 * still mounted temporarily via App.tsx to iterate on.
 */
export default function BrainScene3D() {
    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "#050816",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <Sparkles
                    count={220}
                    scale={[7, 7, 7]}
                    size={1.4}
                    speed={0.15}
                    opacity={0.35}
                    color="#8fb3ff"
                />
                <BrainSystem3D />
                <OrbitRing3D />
                <OrbitControls
                    enablePan={false}
                    minDistance={2.5}
                    maxDistance={7}
                    enableDamping
                    dampingFactor={0.08}
                />
                <GlowLayer />
            </Canvas>
        </div>
    );
}