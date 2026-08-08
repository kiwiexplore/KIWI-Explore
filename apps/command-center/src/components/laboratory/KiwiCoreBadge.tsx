import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AmbientLight, type Line } from "three";
import BrainSystem3D from "../brain/BrainSystem3D";
import GlowLayer from "../brain/GlowLayer";
import "./KiwiCoreBadge.css";

interface KiwiCoreBadgeProps {
    // Same meaning as BrainSystem3D/GlowLayer's own `listening` prop —
    // pauses rotation and boosts glow while Hey Kiwi is listening. Not
    // wired to anything yet (KiwiPanel doesn't exist until a later
    // step) — accepted now so that wiring is a one-line change later.
    listening?: boolean;
}

/**
 * The small "KIWI Core" badge in Laboratory's top bar — the exact same
 * brain used on the Dashboard (BrainSystem3D: neurons + connections +
 * energy pulses + haze, plus GlowLayer's bloom), just without
 * OrbitRing3D (no icons/ring/connections-to-icons) and rendered into a
 * much smaller Canvas, per explicit request. Camera position/fov are
 * deliberately identical to BrainScene3D's own Canvas — shrinking only
 * the CSS container (see KiwiCoreBadge.css) keeps the same framing/
 * composition just physically smaller, rather than needing to retune
 * the geometry itself for a second context.
 */
export default function KiwiCoreBadge({ listening }: KiwiCoreBadgeProps) {
    const ambientLight = useMemo(() => new AmbientLight(0xffffff, 0.5), []);
    const [pulseLines, setPulseLines] = useState<Line[]>([]);

    return (
        <div className="kiwi-core-badge">
            <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ alpha: true }}>
                <primitive object={ambientLight} />
                <group scale={0.96} position={[0, 0.14, 0]}>
                    <BrainSystem3D onPulseReady={setPulseLines} listening={listening} />
                </group>
                <GlowLayer selection={pulseLines} lights={[ambientLight]} boosted={listening} />
            </Canvas>
        </div>
    );
}
