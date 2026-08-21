import {
    BarChart3, Boxes, Check, Clapperboard, Compass, FileText, FlaskConical, FolderKanban,
    Image as ImageIcon, LayoutDashboard, Library, Lightbulb, ListChecks, Megaphone, Package,
    Palette, Plus, Radar, Sparkles, StickyNote, Store, TestTube2, TrendingUp, Video,
    type LucideIcon,
} from "lucide-react";
import type { LaboratorySection } from "./Laboratory";
import type { PhaseProgress } from "../../state/laboratoryJourney";
import "./LaboratorySidebar.css";

interface SidebarItem {
    label: string;
    icon: LucideIcon;
    section?: LaboratorySection;
    // "kiwi" opens KiwiPanel instead of switching section.
    action?: "kiwi";
}

// Where you start, and the one thing the whole journey is about.
// Deliberately outside the numbered phases: neither of these is a step.
const START_ITEMS: SidebarItem[] = [
    { label: "Guide", icon: Compass, section: "guide" },
    { label: "Projects", icon: FolderKanban, section: "projects" },
];

const KIWI_ITEMS: SidebarItem[] = [
    { label: "KIWI Assistant", icon: Sparkles, action: "kiwi" },
];

/**
 * Icons live here rather than in state/laboratoryJourney.ts — that file
 * describes the shape of the work and shouldn't have to import a UI
 * library to do it. The phases and their sections come from there, so
 * this nav and the Guide page can't drift out of step with each other.
 */
const SECTION_ICONS: Partial<Record<LaboratorySection, LucideIcon>> = {
    ideas: Lightbulb,
    notes: StickyNote,
    research: FlaskConical,
    "market-analysis": TrendingUp,
    "trend-scanner": Radar,
    design: Palette,
    "image-generation": ImageIcon,
    tasks: ListChecks,
    prototypes: Boxes,
    resources: Library,
    documents: FileText,
    tests: TestTube2,
    "video-studio": Clapperboard,
    "content-hub": Video,
    products: Package,
    store: Store,
    marketing: Megaphone,
    analytics: BarChart3,
    overview: LayoutDashboard,
};

interface SidebarGroupProps {
    title: string;
    items: SidebarItem[];
    activeSection: LaboratorySection;
    onSectionChange: (section: LaboratorySection) => void;
    onOpenKiwi?: () => void;
    /** Step number and state — the numbered phase groups only. */
    step?: number;
    status?: PhaseProgress["status"];
}

function SidebarGroup({ title, items, activeSection, onSectionChange, onOpenKiwi, step, status }: SidebarGroupProps) {
    return (
        <div className={`lab-sidebar-section${status ? ` lab-sidebar-section-${status}` : ""}`}>
            <div className="lab-sidebar-section-title">
                {step !== undefined && (
                    <span className="lab-sidebar-step" aria-hidden="true">
                        {status === "done" ? <Check size={10} strokeWidth={3.5} /> : step}
                    </span>
                )}
                <span>{title}</span>
                {status === "active" && <span className="lab-sidebar-step-here" aria-label="current phase" />}
            </div>
            {items.map((item) => {
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
                    >
                        <item.icon size={15} strokeWidth={1.75} />
                        <span>{item.label}</span>
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
    /** The focused project's progress — same source as the Guide page. */
    journey: PhaseProgress[];
}

/**
 * Laboratory's left nav, grouped as the seven phases of one journey
 * rather than the four unexplained buckets (MAIN/DEVELOP/LAUNCH/AI
 * TOOLS) it used to have. Every section that was here is still here and
 * still does exactly what it did — what changed is the order and the
 * labelling, because twenty-odd equally weighted items with no stated
 * relationship to one another is what made this hard to navigate.
 *
 * The group headers carry the phase's number and its state for whichever
 * project the Guide is following: a tick once there's something in it, a
 * dot for the one you're on. Nothing is ever disabled — the ordering is
 * advice, and somebody who wants to open Marketing on day one is allowed
 * to.
 */
export default function LaboratorySidebar({
    section, onSectionChange, onCreateProject, onOpenKiwi, journey,
}: LaboratorySidebarProps) {
    return (
        <aside className="lab-sidebar">
            <div className="lab-sidebar-scroll">
                <SidebarGroup
                    title="Start here"
                    items={START_ITEMS}
                    activeSection={section}
                    onSectionChange={onSectionChange}
                    onOpenKiwi={onOpenKiwi}
                />

                {journey.map(({ phase, status }) => (
                    <SidebarGroup
                        key={phase.id}
                        title={phase.label}
                        step={phase.step}
                        status={status}
                        items={phase.sections.map((entry) => ({
                            label: entry.label,
                            icon: SECTION_ICONS[entry.section] ?? LayoutDashboard,
                            section: entry.section,
                        }))}
                        activeSection={section}
                        onSectionChange={onSectionChange}
                    />
                ))}

                <SidebarGroup
                    title="Ask KIWI"
                    items={KIWI_ITEMS}
                    activeSection={section}
                    onSectionChange={onSectionChange}
                    onOpenKiwi={onOpenKiwi}
                />
            </div>

            <button type="button" className="lab-sidebar-new-project" onClick={onCreateProject}>
                <Plus size={16} strokeWidth={2} />
                New Project
            </button>
        </aside>
    );
}
