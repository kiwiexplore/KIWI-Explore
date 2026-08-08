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

export interface LaboratoryProject {
    id: string;
    name: string;
    category: string;
    description: string;
    status: ProjectStatus;
    progress: number; // 0-100
    tags: string[];
    lastActivity: string; // human-readable, static for now — no real activity feed yet
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
    };
}
