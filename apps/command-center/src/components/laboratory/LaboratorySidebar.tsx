import {
    BarChart3, Boxes, FileText, FlaskConical, FolderKanban, Image as ImageIcon,
    LayoutDashboard, Lightbulb, Library, ListChecks, Megaphone, Package, Palette,
    Plus, Radar, Sparkles, StickyNote, Store, TestTube2, TrendingUp, type LucideIcon,
} from "lucide-react";
import type { LaboratorySection } from "./Laboratory";
import "./LaboratorySidebar.css";

interface SidebarItem {
    label: string;
    icon: LucideIcon;
    // Real, navigable sections switch Laboratory's own `section` state.
    // Everything else is a placeholder for now (per explicit request:
    // build the structure first, most modules land later).
    section?: LaboratorySection;
    // "kiwi" opens KiwiPanel instead of switching section.
    action?: "kiwi";
}

const MAIN_ITEMS: SidebarItem[] = [
    { label: "Overview", icon: LayoutDashboard, section: "overview" },
    { label: "Projects", icon: FolderKanban, section: "projects" },
    { label: "Ideas", icon: Lightbulb },
    { label: "Research", icon: FlaskConical, section: "research" },
    { label: "Notes", icon: StickyNote, section: "notes" },
    { label: "Design Studio", icon: Palette },
    { label: "Prototypes", icon: Boxes },
];

const DEVELOP_ITEMS: SidebarItem[] = [
    { label: "Tasks", icon: ListChecks },
    { label: "Resources", icon: Library },
    { label: "Tests", icon: TestTube2 },
    { label: "Documents", icon: FileText },
];

const LAUNCH_ITEMS: SidebarItem[] = [
    { label: "Products", icon: Package },
    { label: "Store", icon: Store },
    { label: "Marketing", icon: Megaphone },
    { label: "Analytics", icon: BarChart3 },
];

const AI_ITEMS: SidebarItem[] = [
    { label: "KIWI Assistant", icon: Sparkles, action: "kiwi" },
    { label: "Image Generation", icon: ImageIcon },
    { label: "Market Analysis", icon: TrendingUp },
    { label: "Trend Scanner", icon: Radar },
];

interface SidebarSectionProps {
    title: string;
    items: SidebarItem[];
    activeSection: LaboratorySection;
    onSectionChange: (section: LaboratorySection) => void;
    onOpenKiwi?: () => void;
}

function SidebarSection({ title, items, activeSection, onSectionChange, onOpenKiwi }: SidebarSectionProps) {
    return (
        <div className="lab-sidebar-section">
            <div className="lab-sidebar-section-title">{title}</div>
            {items.map((item) => {
                const clickable = Boolean(item.section) || item.action === "kiwi";
                const isActive = item.section !== undefined && item.section === activeSection;
                return (
                    <button
                        key={item.label}
                        type="button"
                        className={`lab-sidebar-item${isActive ? " lab-sidebar-item-active" : ""}`}
                        onClick={() => {
                            if (item.section) onSectionChange(item.section);
                            else if (item.action === "kiwi") onOpenKiwi?.();
                        }}
                        disabled={!clickable}
                    >
                        <item.icon size={15} strokeWidth={1.75} />
                        <span>{item.label}</span>
                        {!clickable && <span className="lab-sidebar-item-badge">Soon</span>}
                    </button>
                );
            })}
        </div>
    );
}

interface LaboratorySidebarProps {
    section: LaboratorySection;
    onSectionChange: (section: LaboratorySection) => void;
    onCreateProject: () => void;
    onOpenKiwi?: () => void;
}

/**
 * Laboratory's left nav — MAIN/DEVELOP/LAUNCH/AI TOOLS, matching the
 * original reference mockup's structure. Most items are placeholders
 * (badged "Soon", same honest pattern as InfoPanel's Terms/Privacy) —
 * only Overview/Projects/Research/Notes are real sections so far, and
 * "KIWI Assistant" opens KiwiPanel directly rather than switching
 * sections.
 * Deliberately duplicates the top bar's own Projects/Research/Notes
 * tabs rather than replacing them — the reference mockup itself has
 * both a top nav and this sidebar with overlapping items.
 */
export default function LaboratorySidebar({ section, onSectionChange, onCreateProject, onOpenKiwi }: LaboratorySidebarProps) {
    return (
        <aside className="lab-sidebar">
            <div className="lab-sidebar-scroll">
                <SidebarSection title="Main" items={MAIN_ITEMS} activeSection={section} onSectionChange={onSectionChange} onOpenKiwi={onOpenKiwi} />
                <SidebarSection title="Develop" items={DEVELOP_ITEMS} activeSection={section} onSectionChange={onSectionChange} onOpenKiwi={onOpenKiwi} />
                <SidebarSection title="Launch" items={LAUNCH_ITEMS} activeSection={section} onSectionChange={onSectionChange} onOpenKiwi={onOpenKiwi} />
                <SidebarSection title="AI Tools" items={AI_ITEMS} activeSection={section} onSectionChange={onSectionChange} onOpenKiwi={onOpenKiwi} />
            </div>

            <button type="button" className="lab-sidebar-new-project" onClick={onCreateProject}>
                <Plus size={16} strokeWidth={2} />
                New Project
            </button>
        </aside>
    );
}
