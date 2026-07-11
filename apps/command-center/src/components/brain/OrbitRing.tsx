import type { OrbitModuleDefinition } from "../../types/orbitModule";
import "./OrbitRing.css";

interface OrbitRingProps {
    modules: OrbitModuleDefinition[];
    radius?: number;
}

/**
 * Positions module nodes evenly around a circle using basic trigonometry.
 * This math is pure layout (where things are drawn), not business logic
 * (what they mean) — so it's fine to keep it here in the component
 * rather than pulling it out into features/.
 */
export default function OrbitRing({ modules, radius = 220 }: OrbitRingProps) {

    const angleStep = 360 / modules.length;

    return (
        <div className="orbit-ring">
            {modules.map((module, index) => {

                const angleDeg = angleStep * index - 90; // start at 12 o'clock
                const angleRad = (angleDeg * Math.PI) / 180;

                const x = Math.cos(angleRad) * radius;
                const y = Math.sin(angleRad) * radius;

                return (
                    <div
                        key={module.id}
                        className="orbit-node"
                        style={{
                            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                        }}
                    >

                        <div className="orbit-node-circle">

                            <span className="orbit-node-icon">{module.icon}</span>

                            {module.badgeCount !== undefined && (
                                <span className="orbit-node-badge">{module.badgeCount}</span>
                            )}

                        </div>

                        <div className="orbit-node-label">{module.label}</div>
                        <div className="orbit-node-desc">{module.description}</div>

                    </div>
                );
            })}
        </div>
    );
}