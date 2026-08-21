import type { LaboratorySection } from "../components/laboratory/Laboratory";
import type { LaboratoryProject } from "./laboratoryProjects";

/**
 * The Laboratory as one journey instead of a shelf of panels.
 *
 * Nothing here is a new feature — every section named below already
 * existed and still works exactly as it did. What this file adds is an
 * ORDER and a reason for it: a project starts as an idea, gets looked
 * into, drawn, built, checked, launched, and then measured. The sidebar
 * groups and the guide page both read their structure from here, so the
 * two can't drift apart.
 *
 * The phases are advisory, not gates. A phase reports "upcoming" with a
 * plain-language reason when the work before it hasn't started, but
 * every section stays reachable — being told "you can't open Analytics
 * yet" would be bossy about somebody's own project. Compare Video
 * Studio's own steps, where a disabled button means a real technical
 * dependency (you cannot cut clips out of a transcript that doesn't
 * exist), and the disabling is therefore honest rather than
 * paternalistic.
 */

export type JourneyPhaseId =
    | "idea" | "research" | "design" | "build" | "verify" | "launch" | "measure";

export interface JourneyPhase {
    id: JourneyPhaseId;
    /** 1-based, shown in the sidebar group title and the guide. */
    step: number;
    label: string;
    /** One line on what this phase is FOR, in the guide. */
    blurb: string;
    /** The already-existing sections that belong to this phase. */
    sections: { label: string; section: LaboratorySection }[];
}

export const JOURNEY_PHASES: JourneyPhase[] = [
    {
        id: "idea",
        step: 1,
        label: "Idea",
        blurb: "Get the thing out of your head and written down, however rough.",
        sections: [
            { label: "Ideas", section: "ideas" },
            { label: "Notes", section: "notes" },
        ],
    },
    {
        id: "research",
        step: 2,
        label: "Research",
        blurb: "Find out what already exists, who it's for, and whether anyone wants it.",
        sections: [
            { label: "Research", section: "research" },
            { label: "Market Analysis", section: "market-analysis" },
            { label: "Trend Scanner", section: "trend-scanner" },
        ],
    },
    {
        id: "design",
        step: 3,
        label: "Design",
        blurb: "Decide what it looks like before you spend time building the wrong thing.",
        sections: [
            { label: "Design Studio", section: "design" },
            { label: "Image Generation", section: "image-generation" },
        ],
    },
    {
        id: "build",
        step: 4,
        label: "Build",
        blurb: "The actual making — tasks, prototypes, files, and what you need at hand.",
        sections: [
            { label: "Tasks", section: "tasks" },
            { label: "Prototypes", section: "prototypes" },
            { label: "Resources", section: "resources" },
            { label: "Documents", section: "documents" },
        ],
    },
    {
        id: "verify",
        step: 5,
        label: "Verify",
        blurb: "Check it actually works before anyone else sees it.",
        sections: [
            { label: "Tests", section: "tests" },
        ],
    },
    {
        id: "launch",
        step: 6,
        label: "Launch",
        blurb: "Put it in front of people — the product, where it sells, and how they hear about it.",
        sections: [
            { label: "Video Studio", section: "video-studio" },
            { label: "Content Hub", section: "content-hub" },
            { label: "Products", section: "products" },
            { label: "Store", section: "store" },
            { label: "Marketing", section: "marketing" },
        ],
    },
    {
        id: "measure",
        step: 7,
        label: "Measure",
        blurb: "See where it stands and what to do next time.",
        sections: [
            { label: "Analytics", section: "analytics" },
            { label: "Summary", section: "overview" },
        ],
    },
];

export type PhaseStatus = "done" | "active" | "upcoming";

export interface PhaseProgress {
    phase: JourneyPhase;
    status: PhaseStatus;
    /** How much is in this phase already, e.g. "3 ideas · 1 note". */
    detail: string;
    /**
     * Why this phase reads as upcoming — shown greyed next to it. Null
     * for done/active phases.
     */
    reason: string | null;
}

/** "3 ideas", "1 idea", or nothing at all when the count is zero. */
function count(n: number, singular: string, plural = `${singular}s`): string | null {
    if (n === 0) return null;
    return `${n} ${n === 1 ? singular : plural}`;
}

function join(parts: (string | null)[]): string {
    return parts.filter((p): p is string => p !== null).join(" · ");
}

/**
 * What each phase counts as "started". Deliberately generous — one idea
 * or one note is enough to call the Idea phase done, because the point
 * is to show movement, not to grade the work.
 */
function phaseDetail(phase: JourneyPhase, project: LaboratoryProject): string {
    switch (phase.id) {
        case "idea":
            return join([count(project.ideas.length, "idea"), count(project.notes.length, "note")]);
        case "research":
            return join([
                count(project.research.length, "finding"),
                count(project.marketQueries.length, "market query", "market queries"),
                count(project.trendTopics.length, "tracked topic"),
            ]);
        case "design":
            return join([
                count(project.designRefs.length, "reference"),
                count(project.imagePrompts.length, "image prompt"),
            ]);
        case "build": {
            const doneTasks = project.tasks.filter((t) => t.done).length;
            return join([
                project.tasks.length > 0 ? `${doneTasks}/${project.tasks.length} tasks` : null,
                count(project.prototypes.length, "prototype"),
                count(project.files.length + project.models.length, "file"),
                count(project.resources.length + project.documents.length, "link"),
            ]);
        }
        case "verify": {
            const passing = project.tests.filter((t) => t.status === "passing").length;
            return project.tests.length > 0 ? `${passing}/${project.tests.length} passing` : "";
        }
        case "launch":
            return join([
                count(project.products.length, "product"),
                count(project.storeChannels.length, "channel"),
                count(project.marketing.length, "campaign"),
            ]);
        case "measure":
            return `${project.progress}% overall`;
    }
}

/**
 * Walks the phases in order: everything with something in it is done,
 * the first empty one is where you are, the rest are upcoming and say
 * which phase they're waiting on.
 *
 * Measure is never "active" — it's a place to look, not work to do, so
 * it settles as done once anything at all has been launched and stays
 * upcoming otherwise.
 */
export function deriveJourney(project: LaboratoryProject | null): PhaseProgress[] {
    if (!project) {
        return JOURNEY_PHASES.map((phase) => ({
            phase,
            status: phase.step === 1 ? "active" : "upcoming",
            detail: "",
            reason: phase.step === 1 ? null : "Create a project first — the journey is about one project at a time.",
        }));
    }

    const details = JOURNEY_PHASES.map((phase) => phaseDetail(phase, project));
    // "Started" is just: this phase's detail line has anything to say.
    const started = JOURNEY_PHASES.map((phase, i) => phase.id !== "measure" && details[i] !== "");
    const activeIndex = started.indexOf(false);

    return JOURNEY_PHASES.map((phase, i) => {
        if (phase.id === "measure") {
            const launched = started[JOURNEY_PHASES.findIndex((p) => p.id === "launch")];
            return {
                phase,
                status: launched ? "done" : "upcoming",
                detail: details[i],
                reason: launched ? null : "There's nothing to measure until something has launched.",
            };
        }
        if (started[i]) return { phase, status: "done", detail: details[i], reason: null };
        if (i === activeIndex) return { phase, status: "active", detail: details[i], reason: null };
        return {
            phase,
            status: "upcoming",
            detail: details[i],
            reason: `Usually comes after ${JOURNEY_PHASES[i - 1].label.toLowerCase()} — open it anyway if you're ready.`,
        };
    });
}
