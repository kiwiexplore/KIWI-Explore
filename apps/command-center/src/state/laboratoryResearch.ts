/**
 * Laboratory's global Research — saved findings/references that aren't
 * tied to one project yet (per-project research lives in that
 * project's own "Research" module instead — see ProjectWorkspace).
 * Mock/in-memory only, same as everything else in the account system.
 */
export interface ResearchEntry {
    id: string;
    title: string;
    summary: string;
    tag: string;
    source: string; // a URL/citation string, optional (empty = none)
    savedAt: string; // human-readable, static for now — no real activity feed yet
}

export const MOCK_RESEARCH: ResearchEntry[] = [
    {
        id: "welcome",
        title: "Welcome to Research",
        summary: "Save findings, articles, and references here — tag them so they're easy to find later, whichever project they end up feeding into.",
        tag: "Getting started",
        source: "",
        savedAt: "Just now",
    },
];

let researchCounter = 0;

export function createMockResearchEntry(): ResearchEntry {
    researchCounter += 1;
    return {
        id: `research-${Date.now()}-${researchCounter}`,
        title: `Untitled Finding ${researchCounter}`,
        summary: "",
        tag: "",
        source: "",
        savedAt: "Just now",
    };
}
