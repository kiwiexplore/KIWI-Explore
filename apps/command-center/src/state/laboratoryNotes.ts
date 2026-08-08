/**
 * Laboratory's global Notes — a scratchpad that isn't tied to any one
 * project (per-project notes live in that project's own "Notes" module
 * instead — see ProjectWorkspace). Mock/in-memory only, same as
 * everything else in the account system.
 */
export interface LabNote {
    id: string;
    title: string;
    content: string;
    updatedAt: string; // human-readable, static for now — no real activity feed yet
}

export const MOCK_NOTES: LabNote[] = [
    {
        id: "welcome",
        title: "Welcome to Notes",
        content: "A quick scratchpad for anything that doesn't belong to one specific project yet — ideas, reminders, things to look into later. Click to edit.",
        updatedAt: "Just now",
    },
];

let noteCounter = 0;

export function createMockNote(): LabNote {
    noteCounter += 1;
    return {
        id: `note-${Date.now()}-${noteCounter}`,
        title: `Untitled Note ${noteCounter}`,
        content: "",
        updatedAt: "Just now",
    };
}
