// Client for apps/server's /api/projects routes — the studio's own
// containers: a series, a channel run, a single film, with the ideas
// and videos that belong to it.

import type { VideoProject } from "./videoApi";
import type { LabNote } from "./notesApi";
import type { ContentItem } from "./contentApi";

const API_URL = import.meta.env.VITE_KIWI_API_URL ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_KIWI_API_TOKEN ?? "";

export interface ProjectCounts {
    videos: number;
    published: number;
    failed: number;
    ideas: number;
    ideasDone: number;
    files: number;
}

/** A media file sitting in the project's own folder on disk. */
export interface ProjectFile {
    name: string;
    bytes: number;
    kind: "video" | "audio" | "image";
    modifiedAt: string;
}

export interface StudioProject {
    id: number;
    title: string;
    description: string;
    /** The real folder on this machine where its media lives. */
    folder: string;
    videos: VideoProject[];
    notes: LabNote[];
    files: ProjectFile[];
    counts: ProjectCounts;
    createdAt: string;
    updatedAt: string;
}

/** Raw rows arrive snake_cased; every shape here is normalised once. */
interface RawProject {
    id: number;
    title: string;
    description: string;
    folder: string;
    videos: Record<string, unknown>[];
    notes: Record<string, unknown>[];
    files: ProjectFile[];
    counts: ProjectCounts;
    created_at: string;
    updated_at: string;
}

function toVideo(raw: Record<string, unknown>): VideoProject {
    let clips: VideoProject["clips"] = [];
    if (typeof raw.clips_json === "string" && raw.clips_json) {
        try { clips = JSON.parse(raw.clips_json) as VideoProject["clips"]; } catch { clips = []; }
    }
    return {
        id: Number(raw.id),
        title: String(raw.title),
        stage: raw.stage as VideoProject["stage"],
        track: (raw.track as VideoProject["track"]) ?? "shot",
        exported: Boolean(raw.exported),
        sourceContentId: (raw.source_content_id as number | null) ?? null,
        sourceNoteId: (raw.source_note_id as number | null) ?? null,
        projectId: (raw.project_id as number | null) ?? null,
        sourceVideoPath: (raw.source_video_path as string | null) ?? null,
        transcriptPath: (raw.transcript_path as string | null) ?? null,
        transcriptStatus: raw.transcript_status as VideoProject["transcriptStatus"],
        transcriptError: (raw.transcript_error as string | null) ?? null,
        clips,
        timeline: typeof raw.timeline_json === "string" ? (() => { try { return JSON.parse(raw.timeline_json as string); } catch { return null; } })() : null,
        language: (raw.language as string) ?? "auto",
        transcribing: Boolean(raw.transcribing),
        contentItems: ((raw.contentItems as Record<string, unknown>[]) ?? []).map((i) => ({
            id: Number(i.id),
            type: i.type as ContentItem["type"],
            topic: String(i.topic),
            content: String(i.content),
            status: i.status as ContentItem["status"],
            scheduledDate: (i.scheduled_date as string | null) ?? null,
            created_at: String(i.created_at ?? ""),
        })),
        createdAt: String(raw.created_at ?? ""),
        updatedAt: String(raw.updated_at ?? ""),
    };
}

function toNote(raw: Record<string, unknown>): LabNote {
    return {
        id: Number(raw.id),
        kind: raw.kind as LabNote["kind"],
        title: String(raw.title),
        body: String(raw.body ?? ""),
        projectId: (raw.project_id as number | null) ?? null,
        done: raw.done === 1 || raw.done === true,
        createdAt: String(raw.created_at ?? ""),
        updatedAt: String(raw.updated_at ?? ""),
    };
}

function toProject(raw: RawProject): StudioProject {
    return {
        id: raw.id,
        title: raw.title,
        description: raw.description,
        folder: raw.folder ?? "",
        videos: (raw.videos ?? []).map(toVideo),
        notes: (raw.notes ?? []).map(toNote),
        files: raw.files ?? [],
        counts: raw.counts,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
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

export async function fetchProjects(): Promise<StudioProject[]> {
    const res = await fetch(`${API_URL}/api/projects`, { headers: headers() });
    if (!res.ok) await readError(res, "Could not load projects");
    const data = await res.json();
    return ((data.projects ?? []) as RawProject[]).map(toProject);
}

export async function createProject(title: string): Promise<StudioProject> {
    const res = await fetch(`${API_URL}/api/projects`, {
        method: "POST", headers: headers(), body: JSON.stringify({ title }),
    });
    if (!res.ok) await readError(res, "Could not create the project");
    return toProject((await res.json()).project);
}

export async function updateProject(id: number, changes: { title?: string; description?: string }): Promise<StudioProject> {
    const res = await fetch(`${API_URL}/api/projects/${id}`, {
        method: "PATCH", headers: headers(), body: JSON.stringify(changes),
    });
    if (!res.ok) await readError(res, "Could not save");
    return toProject((await res.json()).project);
}

/** Where the browser plays a file from the project's folder. */
export function projectFileUrl(projectId: number, name: string): string {
    return `${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(name)}`;
}

export async function deleteProject(id: number): Promise<void> {
    await fetch(`${API_URL}/api/projects/${id}`, { method: "DELETE", headers: headers() });
}
