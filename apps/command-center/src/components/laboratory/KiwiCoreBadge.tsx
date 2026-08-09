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
 * OrbitRing3D (no icons/ring/connections-to-icons). Its own camera/
 * group scale are tuned independently from BrainScene3D's Canvas (a
 * closer camera + bigger group scale) so the brain fills this small,
 * fixed-height container edge to edge instead of floating in the
 * middle of it with a lot of empty margin — the Dashboard's own
 * spacious framing (built for orbit icons around it) doesn't fit a
 * cramped corner badge. The container's size (see KiwiCoreBadge.css)
 * is driven by the bar's own height, not the other way around, so the
 * bar can be sized independently of how big the brain reads. Not
 * draggable/rotatable here (interactive=false) — there's no room or
 * reason for that interaction on a small corner badge.
 */
export default function KiwiCoreBadge({ listening }: KiwiCoreBadgeProps) {
    const ambientLight = useMemo(() => new AmbientLight(0xffffff, 0.5), []);
    const [pulseLines, setPulseLines] = useState<Line[]>([]);

    return (
        <div className="kiwi-core-badge">
            <Canvas camera={{ position: [0, 0, 2.6], fov: 50 }} gl={{ alpha: true }}>
                <primitive object={ambientLight} />
                <group scale={1.15} position={[0, -0.08, 0]}>
                    <BrainSystem3D onPulseReady={setPulseLines} listening={listening} interactive={false} />
                </group>
                <GlowLayer selection={pulseLines} lights={[ambientLight]} boosted={listening} />
            </Canvas>
        </div>
    );
}
