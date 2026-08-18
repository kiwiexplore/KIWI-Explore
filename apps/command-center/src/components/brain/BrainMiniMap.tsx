import { brainRegions } from "../../state/brainRegions";
import "./BrainMiniMap.css";

const VIEW = 120;
const CENTER = VIEW / 2;
// The dial is a ring, not a disc: the middle is where "where am I" is
// spelled out, the ring is where you can go from here.
const OUTER_RADIUS = 54;
const INNER_RADIUS = 39;
// Gap between segments, in degrees — enough that the ring reads as
// separate, pickable slices rather than a pie chart.
const SEGMENT_GAP = 4;

function polar(radius: number, degrees: number): [number, number] {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)];
}

/** One slice of the ring, as an SVG path. */
function segmentPath(startDegrees: number, endDegrees: number): string {
    const [outerStartX, outerStartY] = polar(OUTER_RADIUS, startDegrees);
    const [outerEndX, outerEndY] = polar(OUTER_RADIUS, endDegrees);
    const [innerEndX, innerEndY] = polar(INNER_RADIUS, endDegrees);
    const [innerStartX, innerStartY] = polar(INNER_RADIUS, startDegrees);
    const sweep = endDegrees - startDegrees > 180 ? 1 : 0;

    return [
        `M ${outerStartX} ${outerStartY}`,
        `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${sweep} 1 ${outerEndX} ${outerEndY}`,
        `L ${innerEndX} ${innerEndY}`,
        `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${sweep} 0 ${innerStartX} ${innerStartY}`,
        "Z",
    ].join(" ");
}

interface Slice {
    id: string;
    icon: string;
    label: string;
    color: string;
    onSelect: () => void;
    onHoverStart: () => void;
    onHoverEnd: () => void;
    active: boolean;
}

interface BrainMiniMapProps {
    activeRegionId: string | null;
    hoverRegionId: string | null;
    openModuleId: string | null;
    onSelectRegion: (regionId: string) => void;
    onHoverRegion: (regionId: string | null) => void;
    onOpenModule: (moduleId: string | null) => void;
    onReset: () => void;
}

/**
 * The dial in the bottom-left corner: where you are, and what's one step
 * away from here.
 *
 * The ring's contents change with the level you're on — that's the whole
 * idea. From the whole brain it's the six regions; inside a region it's
 * that region's own modules, so the same control keeps working as you go
 * deeper instead of showing a map of somewhere you've already left. The
 * middle always names the level you're on, and doubles as the way back
 * out of it.
 *
 * This replaced a small brain silhouette with a compass needle: the
 * needle told you which way the brain had rotated, which is not the same
 * question as "where am I", and the silhouette was too small at this
 * size to read as anything.
 */
export default function BrainMiniMap({
    activeRegionId, hoverRegionId, openModuleId,
    onSelectRegion, onHoverRegion, onOpenModule, onReset,
}: BrainMiniMapProps) {
    const activeRegion = brainRegions.find((region) => region.id === activeRegionId) ?? null;

    const slices: Slice[] = activeRegion
        ? activeRegion.modules.map((module) => ({
            id: module.id,
            icon: module.icon,
            label: module.label,
            color: activeRegion.color,
            onSelect: () => onOpenModule(module.id),
            onHoverStart: () => {},
            onHoverEnd: () => {},
            active: module.id === openModuleId,
        }))
        : brainRegions.map((region) => ({
            id: region.id,
            icon: region.icon,
            label: region.domain,
            color: region.color,
            onSelect: () => onSelectRegion(region.id),
            onHoverStart: () => onHoverRegion(region.id),
            onHoverEnd: () => onHoverRegion(null),
            active: region.id === hoverRegionId,
        }));

    const step = 360 / slices.length;
    const centerLabel = activeRegion ? activeRegion.domain : "Whole brain";
    const centerIcon = activeRegion ? activeRegion.icon : "🧠";
    const centerColor = activeRegion?.color;

    return (
        <aside className="brain-dial" aria-label="Brain map">
            <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="brain-dial-svg">
                {slices.map((slice, index) => {
                    const start = index * step + SEGMENT_GAP / 2;
                    const end = (index + 1) * step - SEGMENT_GAP / 2;
                    const [iconX, iconY] = polar((OUTER_RADIUS + INNER_RADIUS) / 2, (start + end) / 2);
                    return (
                        <g
                            key={slice.id}
                            className={`brain-dial-slice${slice.active ? " brain-dial-slice-active" : ""}`}
                            style={{ color: slice.color }}
                            onClick={slice.onSelect}
                            onMouseEnter={slice.onHoverStart}
                            onMouseLeave={slice.onHoverEnd}
                        >
                            <title>{slice.label}</title>
                            <path d={segmentPath(start, end)} className="brain-dial-segment" />
                            <text x={iconX} y={iconY} className="brain-dial-slice-icon" textAnchor="middle" dominantBaseline="central">
                                {slice.icon}
                            </text>
                        </g>
                    );
                })}

                {/* The middle: what level you're on, and the way back up
                    from it. Inert at the top level, where there's nowhere
                    further out to go. */}
                <g
                    className={`brain-dial-core${activeRegion ? " brain-dial-core-back" : ""}`}
                    style={{ color: centerColor }}
                    onClick={activeRegion ? (openModuleId ? () => onOpenModule(null) : onReset) : undefined}
                >
                    {activeRegion && <title>{openModuleId ? "Back to the region" : "Back to the whole brain"}</title>}
                    <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 5} className="brain-dial-core-disc" />
                    <text x={CENTER} y={CENTER - 4} className="brain-dial-core-icon" textAnchor="middle" dominantBaseline="central">
                        {centerIcon}
                    </text>
                </g>
            </svg>

            <div className="brain-dial-label" style={{ color: centerColor }}>
                {centerLabel}
            </div>
        </aside>
    );
}
