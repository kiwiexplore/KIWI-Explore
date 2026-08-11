import type { LabNote } from "./laboratoryNotes";
import type { ResearchEntry } from "./laboratoryResearch";

/**
 * Laboratory's project registry — deliberately domain-agnostic. A
 * project here isn't "a hiking jacket" or "a startup", it's just
 * PROJECT -> WORKSPACE -> MODULES; `category`/`tags` are freeform
 * strings the user would eventually set themselves, not a fixed enum,
 * since Laboratory has to work equally well for software, research, a
 * film, an album, or anything else. Mock data only for now — no
 * backend, same as the rest of the account system.
 */
export type ProjectStatus = "active" | "research" | "paused" | "completed";

export interface ProjectTask {
    id: string;
    title: string;
    done: boolean;
}

export interface ProjectIdea {
    id: string;
    text: string;
}

export interface LaboratoryProject {
    id: string;
    name: string;
    category: string;
    description: string;
    status: ProjectStatus;
    progress: number; // 0-100
    tags: string[];
    lastActivity: string; // human-readable, static for now — no real activity feed yet
    tasks: ProjectTask[];
    ideas: ProjectIdea[];
    // Reuses the exact same LabNote/ResearchEntry shapes as Laboratory's
    // global Notes/Research sections — these are scoped to just this
    // project, unlike the global lists.
    notes: LabNote[];
    research: ResearchEntry[];
}

export const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
    active: { label: "Active", color: "var(--secondary)" },
    research: { label: "Research", color: "var(--primary)" },
    paused: { label: "Paused", color: "var(--text-muted)" },
    completed: { label: "Completed", color: "var(--secondary)" },
};

// Intentionally spans very different kinds of work (software, music,
// research) — proof that nothing about the card/workspace UI assumes
// any one domain.
export const MOCK_PROJECTS: LaboratoryProject[] = [
    {
        id: "kiwi-ai-os",
        name: "KIWI AI OS",
        category: "Development",
        description: "The AI operating system this Laboratory itself lives inside of.",
        status: "active",
        progress: 42,
        tags: ["Software", "AI"],
        lastActivity: "Just now",
        tasks: [
            { id: "task-1", title: "Wire the shared calendar into the Dashboard widget", done: true },
            { id: "task-2", title: "Build a real Tasks module", done: true },
            { id: "task-3", title: "Design the Files module", done: false },
        ],
        ideas: [
            { id: "idea-p1", text: "Let KIWI Assistant suggest which module to open next based on what you're doing" },
        ],
        notes: [
            { id: "note-p1", title: "Architecture notes", content: "Keep the account state lifted to App.tsx — both scenes need to read/write the same identity, background, and now calendar.", updatedAt: "Just now" },
        ],
        research: [
            { id: "research-p1", title: "Selective bloom vs plain threshold", summary: "Plain luminance-threshold Bloom couldn't isolate pulse lines from ambient neurons — switched to SelectiveBloom.", tag: "Rendering", source: "", savedAt: "Just now" },
        ],
    },
    {
        id: "debut-ep",
        name: "Debut EP",
        category: "Music",
        description: "Five-track EP — writing, recording, and mixing.",
        status: "research",
        progress: 18,
        tags: ["Audio", "Production"],
        lastActivity: "2 days ago",
        tasks: [
            { id: "task-4", title: "Finish lyrics for track 3", done: false },
            { id: "task-5", title: "Book studio time", done: false },
        ],
        ideas: [],
        notes: [],
        research: [],
    },
    {
        id: "materials-study",
        name: "Materials Study",
        category: "Research",
        description: "Comparing lightweight composites for a new prototype.",
        status: "paused",
        progress: 60,
        tags: ["Science", "Prototype"],
        lastActivity: "1 week ago",
        tasks: [],
        ideas: [],
        notes: [],
        research: [],
    },
];

let mockProjectCounter = 0;

export function createMockProject(): LaboratoryProject {
    mockProjectCounter += 1;
    return {
        id: `untitled-${Date.now()}-${mockProjectCounter}`,
        name: `Untitled Project ${mockProjectCounter}`,
        category: "New",
        description: "Nothing here yet — start filling this in.",
        status: "research",
        progress: 0,
        tags: [],
        lastActivity: "Just now",
        tasks: [],
        ideas: [],
        notes: [],
        research: [],
    };
}
