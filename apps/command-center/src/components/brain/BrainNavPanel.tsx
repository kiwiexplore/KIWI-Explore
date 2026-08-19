import type { CSSProperties } from "react";
import { ChevronRight, Compass } from "lucide-react";
import { brainRegions } from "../../state/brainRegions";
import "./BrainNavPanel.css";

interface BrainNavPanelProps {
    activeRegionId: string | null;
    hoverRegionId: string | null;
    onSelect: (id: string) => void;
    onHover: (id: string | null) => void;
}

/**
 * The Dashboard's map of the brain — the left rail that walks you
 * through its regions. Every row is the exact same action as clicking
 * that region on the brain itself (see BrainSystem3D's own hit surface):
 * the camera flies inside the brain, that region's wall swings around in
 * front of it, its neurons brighten, and its panel opens. Hovering a row
 * previews the region on the brain without committing to it, so you can
 * find the area you want without the scene lurching around on every
 * mouse move.
 *
 * There is deliberately no "back to the whole brain" button here: the
 * dial's own centre is that control (see BrainMiniMap), and having it in
 * both places only cost the rail a row.
 *
 * This rail plus the brain's own clickable surface replaced the orbiting
 * icon ring AND both widget columns (all removed per explicit request) —
 * the point of the new layout is that the brain gets the whole screen
 * and everything
 * else floats over it.
 */
export default function BrainNavPanel({ activeRegionId, hoverRegionId, onSelect, onHover }: BrainNavPanelProps) {
    return (
        <nav className="brain-nav" onMouseLeave={() => onHover(null)}>
            <div className="brain-nav-header">
                <Compass size={15} strokeWidth={1.75} color="#49C7FF" />
                <span>Neural map</span>
            </div>

            <div className="brain-nav-list">
                {brainRegions.map((region) => {
                    const isActive = region.id === activeRegionId;
                    const isHovered = region.id === hoverRegionId;
                    return (
                        <button
                            key={region.id}
                            type="button"
                            className={`brain-nav-item${isActive ? " brain-nav-item-active" : ""}${isHovered ? " brain-nav-item-hovered" : ""}`}
                            style={{ "--region-color": region.color } as CSSProperties}
                            onClick={() => onSelect(region.id)}
                            onMouseEnter={() => onHover(region.id)}
                            onFocus={() => onHover(region.id)}
                            onBlur={() => onHover(null)}
                        >
                            <span className="brain-nav-item-icon">{region.icon}</span>
                            <span className="brain-nav-item-text">
                                <span className="brain-nav-item-domain">{region.domain}</span>
                                <span className="brain-nav-item-label">{region.label}</span>
                            </span>
                            <ChevronRight size={14} strokeWidth={2} className="brain-nav-item-chevron" />
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
