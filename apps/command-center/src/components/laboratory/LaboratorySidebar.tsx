import { FlaskConical, Lightbulb, Plus, Radar, Sparkles, StickyNote, Video, type LucideIcon } from "lucide-react";
import type { LaboratorySection } from "./Laboratory";
import "./LaboratorySidebar.css";

interface SidebarItem {
    label: string;
    icon: LucideIcon;
    section?: LaboratorySection;
    /** "kiwi" opens KiwiPanel instead of switching section. */
    action?: "kiwi";
}

/**
 * What feeds a video without belonging to any one of them.
 *
 * The rail used to lead with "Your videos" and "Video Studio", which
 * the stage strip now owns — two ways to reach the same screen, with
 * the sidebar's version silently disagreeing about which stage you were
 * on. It also listed Thumbnails and Analytics, both of which still only
 * log what you type at them.
 *
 * What's left is the material: things you collect between videos and
 * draw on while making one. The pipeline is the strip along the top;
 * this is the shelf beside it.
 */
const MATERIAL_ITEMS: SidebarItem[] = [
    { label: "Ideas", icon: Lightbulb, section: "ideas" },
    { label: "Trends", icon: Radar, section: "trend-scanner" },
    { label: "Research", icon: FlaskConical, section: "research" },
    { label: "Notes", icon: StickyNote, section: "notes" },
];

const OUTPUT_ITEMS: SidebarItem[] = [
    { label: "Posts & ads", icon: Video, section: "content-hub" },
];

interface ItemButtonProps {
    item: SidebarItem;
    activeSection: LaboratorySection;
    onSectionChange: (section: LaboratorySection) => void;
    onOpenKiwi?: () => void;
}

function ItemButton({ item, activeSection, onSectionChange, onOpenKiwi }: ItemButtonProps) {
    const isActive = item.section !== undefined && item.section === activeSection;
    return (
        <button
            type="button"
            className={`lab-sidebar-item${isActive ? " lab-sidebar-item-active" : ""}`}
            onClick={() => {
                if (item.section) onSectionChange(item.section);
                else if (item.action === "kiwi") onOpenKiwi?.();
            }}
        >
            <item.icon size={15} strokeWidth={1.75} />
            <span>{item.label}</span>
        </button>
    );
}

interface LaboratorySidebarProps {
    section: LaboratorySection;
    onSectionChange: (section: LaboratorySection) => void;
    /** Starts a video and opens it — not a Laboratory project. */
    onNewVideo: () => void;
    onOpenKiwi?: () => void;
}

export default function LaboratorySidebar({ section, onSectionChange, onNewVideo, onOpenKiwi }: LaboratorySidebarProps) {
    const shared = { activeSection: section, onSectionChange, onOpenKiwi };

    return (
        <aside className="lab-sidebar">
            <div className="lab-sidebar-scroll">
                <div className="lab-sidebar-section">
                    <div className="lab-sidebar-section-title"><span>Material</span></div>
                    {MATERIAL_ITEMS.map((item) => <ItemButton key={item.label} item={item} {...shared} />)}
                </div>

                <div className="lab-sidebar-section">
                    <div className="lab-sidebar-section-title"><span>Goes out with it</span></div>
                    {OUTPUT_ITEMS.map((item) => <ItemButton key={item.label} item={item} {...shared} />)}
                </div>

                <div className="lab-sidebar-section">
                    <button type="button" className="lab-sidebar-item" onClick={() => onOpenKiwi?.()}>
                        <Sparkles size={15} strokeWidth={1.75} />
                        <span>Ask KIWI</span>
                    </button>
                </div>
            </div>

            {/* Was "New Project", which made a mock Laboratory project
                nothing in the studio ever reads. */}
            <button type="button" className="lab-sidebar-new-project" onClick={onNewVideo}>
                <Plus size={16} strokeWidth={2} />
                New video
            </button>
        </aside>
    );
}
