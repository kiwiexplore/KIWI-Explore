// Client for apps/server's /api/notes routes — the Laboratory's ideas,
// tracked trends, findings and loose notes. Same backend and trust
// model as videoApi.ts.

const API_URL = import.meta.env.VITE_KIWI_API_URL ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_KIWI_API_TOKEN ?? "";

export type LabNoteKind = "idea" | "trend" | "research" | "note";

export interface LabNote {
    id: number;
    kind: LabNoteKind;
    title: string;
    body: string;
    /** Which project it belongs to, or null if it's loose. */
    projectId: number | null;
    /** Ticked off. */
    done: boolean;
    createdAt: string;
    updatedAt: string;
}

interface RawLabNote {
    id: number;
    kind: LabNoteKind;
    title: string;
    body: string;
    project_id: number | null;
    done: number;
    created_at: string;
    updated_at: string;
}

function toNote(raw: RawLabNote): LabNote {
    return {
        id: raw.id, kind: raw.kind, title: raw.title, body: raw.body,
        projectId: raw.project_id ?? null, done: raw.done === 1,
        createdAt: raw.created_at, updatedAt: raw.updated_at,
    };
}

function headers(): HeadersInit {
    return {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    };
}

async function readError(res: Response, fallback: string): Promise<never> {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `${fallback}: ${res.status}`);
}

export async function fetchNotes(kind?: LabNoteKind): Promise<LabNote[]> {
    const query = kind ? `?kind=${kind}` : "";
    const res = await fetch(`${API_URL}/api/notes${query}`, { headers: headers() });
    if (!res.ok) await readError(res, "Could not load notes");
    const data = await res.json();
    return ((data.notes ?? []) as RawLabNote[]).map(toNote);
}

export async function createNote(kind: LabNoteKind, title: string, projectId?: number): Promise<LabNote> {
    const res = await fetch(`${API_URL}/api/notes`, {
        method: "POST", headers: headers(), body: JSON.stringify({ kind, title, projectId }),
    });
    if (!res.ok) await readError(res, "Could not save that");
    return toNote((await res.json()).note);
}

export async function updateNote(id: number, changes: { title?: string; body?: string; done?: boolean }): Promise<LabNote> {
    const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: "PATCH", headers: headers(), body: JSON.stringify(changes),
    });
    if (!res.ok) await readError(res, "Could not save that");
    return toNote((await res.json()).note);
}

export async function deleteNote(id: number): Promise<void> {
    await fetch(`${API_URL}/api/notes/${id}`, { method: "DELETE", headers: headers() });
}
