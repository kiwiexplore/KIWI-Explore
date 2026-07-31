import type { OrbitModuleDefinition } from "../../types/orbitModule";
import "./OrbitRing.css";

interface OrbitRingProps {
    modules: OrbitModuleDefinition[];
    radius?: number;
    /** Radius at which connector lines start — roughly the Brain's edge,
     *  so lines appear to grow out of the brain surface instead of
     *  converging on a single point at the exact center. */
    innerRadius?: number;
}

interface PositionedModule {
    module: OrbitModuleDefinition;
    angleRad: number;
    x: number;
    y: number;
}

/**
 * Computes evenly-spaced (x, y) offsets from center for each module.
 * Pure layout math, not business logic — shared by both the SVG lines
 * and the icon nodes below so they always line up with each other.
 */
function layoutModules(modules: OrbitModuleDefinition[], radius: number): PositionedModule[] {

    const angleStep = 360 / modules.length;

    return modules.map((module, index) => {
        const angleDeg = angleStep * index - 90; // start at 12 o'clock
        const angleRad = (angleDeg * Math.PI) / 180;

        return {
            module,
            angleRad,
            x: Math.cos(angleRad) * radius,
            y: Math.sin(angleRad) * radius,
        };
    });
}

/**
 * Builds a gently curved connector path from a point near the Brain's
 * surface out to a module node, instead of a straight spoke to the exact
 * center. The curve bows sideways (perpendicular to the radial direction)
 * so the whole ring reads as organic "synapses" rather than wheel spokes.
 */
function buildConnectorPath(angleRad: number, endX: number, endY: number, innerRadius: number, index: number): string {

    const startX = Math.cos(angleRad) * innerRadius;
    const startY = Math.sin(angleRad) * innerRadius;

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // perpendicular direction to the radial line, alternating side + varying
    // amount per index so the curves don't all bow identically
    const perpX = -Math.sin(angleRad);
    const perpY = Math.cos(angleRad);
    const side = index % 2 === 0 ? 1 : -1;
    const amount = 22 + (index % 4) * 7;

    const controlX = midX + perpX * amount * side;
    const controlY = midY + perpY * amount * side;

    return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

export default function OrbitRing({ modules, radius = 220, innerRadius = radius * 0.62 }: OrbitRingProps) {

    const positioned = layoutModules(modules, radius);
    const viewBoxHalf = radius + 60;

    return (
        <div className="orbit-ring">

            <svg
                className="orbit-lines"
                viewBox={`${-viewBoxHalf} ${-viewBoxHalf} ${viewBoxHalf * 2} ${viewBoxHalf * 2}`}
            >
                {positioned.map(({ module, angleRad, x, y }, index) => (
                    <path
                        key={module.id}
                        d={buildConnectorPath(angleRad, x, y, innerRadius, index)}
                        className="orbit-line"
                        style={{ animationDelay: `${index * 0.15}s` }}
                    />
                ))}
            </svg>

            {positioned.map(({ module, x, y }, index) => (
                <div
                    key={module.id}
                    className="orbit-node"
                    style={{
                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    }}
                >

                    <div
                        className="orbit-node-circle"
                        style={{ animationDelay: `${index * 0.15}s` }}
                    >

                        <span className="orbit-node-icon">{module.icon}</span>

                        {module.badgeCount !== undefined && (
                            <span className="orbit-node-badge">{module.badgeCount}</span>
                        )}

                    </div>

                    <div className="orbit-node-label">{module.label}</div>
                    <div className="orbit-node-desc">{module.description}</div>

                </div>
            ))}

        </div>
    );
}