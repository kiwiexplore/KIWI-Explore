import Brain from "./Brain";
import OrbitRing from "./OrbitRing";
import { orbitModules } from "../../state/orbitModules";
import "./BrainSystem.css";

/**
 * Combines the pulsing Brain core with its orbiting module ring.
 * Kept as a separate component so Brain.tsx stays a small, reusable
 * "just the glowing core" piece — useful later anywhere the full ring
 * doesn't fit (e.g. a compact header on mobile).
 */
export default function BrainSystem() {
    return (
        <div className="brain-system">

            <div className="brain-system-ring">
                <OrbitRing modules={orbitModules} radius={260} innerRadius={180} />
            </div>

            <div className="brain-system-core">
                <Brain />
            </div>

        </div>
    );
}