import { Html, Line } from "@react-three/drei";
import {
    Newspaper, Mountain, Calendar, FolderKanban, TrendingUp,
    BookOpen, FileText, Activity, Mail, Plane,
} from "lucide-react";
import { orbitModules } from "../../state/orbitModules";
import "./OrbitRing3D.css";

const RADIUS = 1.55;
const INNER_RADIUS = 1.05;

/**
 * Local icon lookup for the 3D scene only — deliberately NOT stored on
 * the shared orbitModules data, since the 2D SVG OrbitRing still expects
 * `module.icon` to be an emoji string and we don't want to touch that
 * working path. This keeps the 3D upgrade isolated to 3D.
 */
const ICONS: Record<string, typeof Newspaper> = {
    news: Newspaper,
    adventure: Mountain,
    calendar: Calendar,
    projects: FolderKanban,
    finance: TrendingUp,
    learning: BookOpen,
    documents: FileText,
    health: Activity,
    communication: Mail,
    travel: Plane,
};

interface Positioned {
    module: (typeof orbitModules)[number];
    x: number;
    y: number;
    angle: number;
    index: number;
}

function layoutModules(): Positioned[] {
    const n = orbitModules.length;
    const step = (2 * Math.PI) / n;

    return orbitModules.map((module, i) => {
        const angle = step * i - Math.PI / 2;
        return {
            module,
            angle,
            index: i,
            x: Math.cos(angle) * RADIUS,
            y: Math.sin(angle) * RADIUS,
        };
    });
}

/**
 * Quadratic-bezier curve from near the Brain's surface out to a module,
 * bowed sideways AND slightly in/out of screen depth (not a flat 2D
 * arc), so it reads as an organic neural connection rather than a wire.
 */
function buildCurve(angle: number, x: number, y: number, index: number): [number, number, number][] {
    const ix = Math.cos(angle) * INNER_RADIUS;
    const iy = Math.sin(angle) * INNER_RADIUS;

    const midX = (ix + x) / 2;
    const midY = (iy + y) / 2;

    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const side = index % 2 === 0 ? 1 : -1;
    const amount = 0.16 + (index % 4) * 0.045;

    const cx = midX + perpX * amount * side;
    const cy = midY + perpY * amount * side;
    const cz = side * (0.10 + (index % 3) * 0.04);

    const points: [number, number, number][] = [];
    const STEPS = 16;
    for (let s = 0; s <= STEPS; s++) {
        const t = s / STEPS;
        const mt = 1 - t;
        points.push([
            mt * mt * ix + 2 * mt * t * cx + t * t * x,
            mt * mt * iy + 2 * mt * t * cy + t * t * y,
            2 * mt * t * cz,
        ]);
    }
    return points;
}

/** Small forking sub-branch partway along the main curve — the "dendrite" detail. */
function buildFork(mainCurve: [number, number, number][], angle: number, index: number): [number, number, number][] {
    const start = mainCurve[Math.round(mainCurve.length * 0.55)];
    const forkAngle = angle + (index % 2 === 0 ? 0.9 : -0.9);
    const len = 0.16;
    const end: [number, number, number] = [
        start[0] + Math.cos(forkAngle) * len,
        start[1] + Math.sin(forkAngle) * len,
        start[2] + (index % 2 === 0 ? 0.05 : -0.05),
    ];
    return [start, end];
}

export default function OrbitRing3D() {
    const positioned = layoutModules();

    return (
        <group>

            {positioned.map(({ module, x, y, angle, index }) => {
                const curve = buildCurve(angle, x, y, index);
                const fork = buildFork(curve, angle, index);

                return (
                    <group key={module.id}>
                        <Line points={curve} color="#49C7FF" transparent opacity={0.4} lineWidth={1} />
                        <Line points={fork} color="#8fd6ff" transparent opacity={0.3} lineWidth={1} />
                    </group>
                );
            })}

            {positioned.map(({ module, x, y }) => {
                const Icon = ICONS[module.id];

                return (
                    <Html key={module.id} position={[x, y, 0]} center distanceFactor={6}>
                        <div className="orbit3d-node">

                            <div className="orbit3d-circle">

                                {Icon && <Icon size={19} color="#eaf6ff" strokeWidth={1.75} />}

                                {module.badgeCount !== undefined && (
                                    <span className="orbit3d-badge">{module.badgeCount}</span>
                                )}

                            </div>

                            <div className="orbit3d-label">{module.label}</div>

                        </div>
                    </Html>
                );
            })}

        </group>
    );
}