import {
    BarChart3, Clapperboard, FlaskConical, Image as ImageIcon, LayoutDashboard, Lightbulb, Plus, Radar, Sparkles, StickyNote, Video,
    type LucideIcon,
} from "lucide-react";
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
 * Making a video, in order. These nine are what the work actually needs;
 * everything else the Laboratory can do is a click away under "More
 * tools" and out of the way until then.
 */
const MAKE_ITEMS: SidebarItem[] = [
    { label: "Your videos", icon: LayoutDashboard, section: "guide" },
    { label: "Video Studio", icon: Clapperboard, section: "video-studio" },
];

const BEFORE_ITEMS: SidebarItem[] = [
    { label: "Ideas", icon: Lightbulb, section: "ideas" },
    { label: "Trends", icon: Radar, section: "trend-scanner" },
    { label: "Research", icon: FlaskConical, section: "research" },
    { label: "Notes", icon: StickyNote, section: "notes" },
];

const AFTER_ITEMS: SidebarItem[] = [
    { label: "Posts & ads", icon: Video, section: "content-hub" },
    { label: "Thumbnails", icon: ImageIcon, section: "image-generation" },
    { label: "Analytics", icon: BarChart3, section: "analytics" },
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
    onCreateProject: () => void;
    onOpenKiwi?: () => void;
}

/**
 * Laboratory's left nav, cut down to what making a video needs.
 *
 * It used to list twenty-one equally weighted sections in four buckets
 * with nothing saying which mattered — a prototype tracker and a store
 * channel list presented as equal in importance to the thing you came
 * here to do.
 *
 * The sections that aren't part of making a video are no longer listed.
 * None of them were deleted: they keep their entries in
 * LaboratorySection and their render branches in Laboratory.tsx, so
 * putting any one back is a single line in this file.
 */
export default function LaboratorySidebar({ section, onSectionChange, onCreateProject, onOpenKiwi }: LaboratorySidebarProps) {
    const shared = { activeSection: section, onSectionChange, onOpenKiwi };

    return (
        <aside className="lab-sidebar">
            <div className="lab-sidebar-scroll">
                <div className="lab-sidebar-section">
                    {MAKE_ITEMS.map((item) => <ItemButton key={item.label} item={item} {...shared} />)}
                </div>

                <div className="lab-sidebar-section">
                    <div className="lab-sidebar-section-title"><span>Before you record</span></div>
                    {BEFORE_ITEMS.map((item) => <ItemButton key={item.label} item={item} {...shared} />)}
                </div>

                <div className="lab-sidebar-section">
                    <div className="lab-sidebar-section-title"><span>After it's cut</span></div>
                    {AFTER_ITEMS.map((item) => <ItemButton key={item.label} item={item} {...shared} />)}
                </div>


                <div className="lab-sidebar-section">
                    <button type="button" className="lab-sidebar-item" onClick={() => onOpenKiwi?.()}>
                        <Sparkles size={15} strokeWidth={1.75} />
                        <span>Ask KIWI</span>
                    </button>
                </div>
            </div>

            <button type="button" className="lab-sidebar-new-project" onClick={onCreateProject}>
                <Plus size={16} strokeWidth={2} />
                New Project
            </button>
        </aside>
    );
}
