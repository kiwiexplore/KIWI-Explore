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

export interface ProjectDesignRef {
    id: string;
    label: string;
    url: string;
}

export type PrototypeStage = "planned" | "building" | "testing" | "shipped";

export interface ProjectPrototype {
    id: string;
    label: string;
    url: string;
    stage: PrototypeStage;
}

// No real upload/backend yet — a "file" here is just a tracked
// filename, same mock-data philosophy as everything else in this
// registry. Real storage is a backend concern for later.
export interface ProjectFile {
    id: string;
    name: string;
}

// A link out to something the project depends on but doesn't own —
// docs, a library, a tool, a reference site. Same {label, url} shape
// as ProjectDesignRef, kept as its own array/type since it's a
// different sidebar section (Develop, not Main).
export interface ProjectResource {
    id: string;
    label: string;
    url: string;
}

export type TestStatus = "untested" | "passing" | "failing";

export interface ProjectTest {
    id: string;
    title: string;
    status: TestStatus;
}

// A link out to a formal written document (spec, contract, deck)
// living somewhere else — distinct from Notes, which are in-app
// freeform scratch content (see LabNote).
export interface ProjectDocument {
    id: string;
    label: string;
    url: string;
}

export type ProductStage = "idea" | "building" | "launched";

export interface ProjectProduct {
    id: string;
    name: string;
    price: string; // freeform ("$29", "€12/mo", "" if not priced yet) — no currency/commerce logic, just a label
    stage: ProductStage;
}

// A place the finished thing is (or will be) sold/distributed — an
// Etsy shop, the App Store, Bandcamp, a Shopify storefront. Same
// {label, url} shape as everything else that's just a tracked link.
export interface ProjectStoreChannel {
    id: string;
    label: string;
    url: string;
}

export type MarketingStatus = "planned" | "active" | "done";

export interface ProjectMarketingItem {
    id: string;
    label: string;
    status: MarketingStatus;
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
    designRefs: ProjectDesignRef[];
    prototypes: ProjectPrototype[];
    files: ProjectFile[];
    resources: ProjectResource[];
    tests: ProjectTest[];
    documents: ProjectDocument[];
    products: ProjectProduct[];
    storeChannels: ProjectStoreChannel[];
    marketing: ProjectMarketingItem[];
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

// Cycle order for clicking a prototype's stage pill: planned -> building
// -> testing -> shipped -> back to planned.
export const PROTOTYPE_STAGE_ORDER: PrototypeStage[] = ["planned", "building", "testing", "shipped"];

export const PROTOTYPE_STAGE_META: Record<PrototypeStage, { label: string; color: string }> = {
    planned: { label: "Planned", color: "var(--text-muted)" },
    building: { label: "Building", color: "var(--primary)" },
    testing: { label: "Testing", color: "var(--accent)" },
    shipped: { label: "Shipped", color: "var(--secondary)" },
};

// Cycle order for clicking a test's status pill: untested -> passing ->
// failing -> back to untested, same click-to-advance interaction as
// prototype stages.
export const TEST_STATUS_ORDER: TestStatus[] = ["untested", "passing", "failing"];

export const TEST_STATUS_META: Record<TestStatus, { label: string; color: string }> = {
    untested: { label: "Untested", color: "var(--text-muted)" },
    passing: { label: "Passing", color: "var(--secondary)" },
    failing: { label: "Failing", color: "var(--danger)" },
};

// Cycle order for clicking a product's stage pill: idea -> building ->
// launched -> back to idea, same click-to-advance interaction as
// prototype stages.
export const PRODUCT_STAGE_ORDER: ProductStage[] = ["idea", "building", "launched"];

export const PRODUCT_STAGE_META: Record<ProductStage, { label: string; color: string }> = {
    idea: { label: "Idea", color: "var(--text-muted)" },
    building: { label: "Building", color: "var(--primary)" },
    launched: { label: "Launched", color: "var(--secondary)" },
};

// Cycle order for clicking a marketing item's status pill: planned ->
// active -> done -> back to planned.
export const MARKETING_STATUS_ORDER: MarketingStatus[] = ["planned", "active", "done"];

export const MARKETING_STATUS_META: Record<MarketingStatus, { label: string; color: string }> = {
    planned: { label: "Planned", color: "var(--text-muted)" },
    active: { label: "Active", color: "var(--accent)" },
    done: { label: "Done", color: "var(--secondary)" },
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
        designRefs: [
            { id: "design-p1", label: "Selective bloom reference reel", url: "https://example.com/bloom-reference" },
        ],
        prototypes: [
            { id: "proto-p1", label: "Laboratory workspace", url: "", stage: "testing" },
        ],
        files: [
            { id: "file-p1", name: "brain-shader-notes.glsl" },
        ],
        resources: [
            { id: "resource-p1", label: "React Three Fiber docs", url: "https://docs.pmnd.rs/react-three-fiber" },
        ],
        tests: [
            { id: "test-p1", title: "Focus timer completes and chimes at 0:00", status: "passing" },
            { id: "test-p2", title: "Sidebar scroll reaches AI Tools items", status: "failing" },
        ],
        documents: [],
        products: [
            { id: "product-p1", name: "KIWI Laboratory (personal mode)", price: "", stage: "building" },
        ],
        storeChannels: [],
        marketing: [
            { id: "marketing-p1", label: "Sprint changelog on X", status: "active" },
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
        designRefs: [],
        prototypes: [],
        files: [],
        resources: [],
        tests: [],
        documents: [],
        products: [],
        storeChannels: [],
        marketing: [],
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
        designRefs: [],
        prototypes: [],
        files: [],
        resources: [],
        tests: [],
        documents: [],
        products: [],
        storeChannels: [],
        marketing: [],
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
        designRefs: [],
        prototypes: [],
        files: [],
        resources: [],
        tests: [],
        documents: [],
        products: [],
        storeChannels: [],
        marketing: [],
        notes: [],
        research: [],
    };
}
