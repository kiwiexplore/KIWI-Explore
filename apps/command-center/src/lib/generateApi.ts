// Client for apps/server's /api/generate — the generation queue.
//
// A job outlives the screen that started it, so nothing here holds a
// request open: you enqueue, and then you follow the rows.

const API_URL = import.meta.env.VITE_KIWI_API_URL ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_KIWI_API_TOKEN ?? "";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type JobKind = "image" | "video";

export interface GenerationJob {
    id: number;
    projectId: number;
    videoProjectId: number | null;
    kind: JobKind;
    engine: string;
    prompt: string;
    params: Record<string, unknown>;
    status: JobStatus;
    progress: number;
    error: string | null;
    /** The file it made, by name inside the project's folder. */
    outputFile: string | null;
    /** True only while a job is genuinely running in the server process.
     *  Distinct from status === "running", which can outlive the process
     *  that set it if the server dies mid-job. */
    live: boolean;
    createdAt: string;
}

export interface Engine {
    id: string;
    label: string;
    kinds: JobKind[];
    where: "local" | "cloud";
    /** Whether it can be used right now. */
    ready: boolean;
    /** Why not, when it isn't. Written to be shown as-is. */
    why: string | null;
}

interface RawJob {
    id: number;
    project_id: number;
    video_project_id: number | null;
    kind: JobKind;
    engine: string;
    prompt: string;
    params_json: string;
    status: JobStatus;
    progress: number;
    error: string | null;
    output_file: string | null;
    live?: boolean;
    created_at: string;
}

function toJob(raw: RawJob): GenerationJob {
    // Stored as text; a malformed value shouldn't take the row down.
    let params: Record<string, unknown>;
    try { params = JSON.parse(raw.params_json) as Record<string, unknown>; } catch { params = {}; }
    return {
        id: raw.id,
        projectId: raw.project_id,
        videoProjectId: raw.video_project_id,
        kind: raw.kind,
        engine: raw.engine,
        prompt: raw.prompt,
        params,
        status: raw.status,
        progress: raw.progress,
        error: raw.error,
        outputFile: raw.output_file,
        live: Boolean(raw.live),
        createdAt: raw.created_at,
    };
}

function headers(): HeadersInit {
    return {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    };
}

/**
 * Thrown for 503 — the engine isn't there. Distinct from a generic
 * failure so the UI can show it as a setup step, since the message says
 * exactly what to start or set.
 */
export class EngineUnavailableError extends Error {}

async function readError(res: Response, fallback: string): Promise<never> {
    const data = await res.json().catch(() => null);
    const message = data?.error ?? `${fallback}: ${res.status}`;
    if (res.status === 503) throw new EngineUnavailableError(message);
    throw new Error(message);
}

export async function fetchEngines(): Promise<Engine[]> {
    const res = await fetch(`${API_URL}/api/generate/engines`, { headers: headers() });
    if (!res.ok) await readError(res, "Could not read the engines");
    return (await res.json()).engines as Engine[];
}

export async function fetchJobs(projectId: number): Promise<GenerationJob[]> {
    const res = await fetch(`${API_URL}/api/generate?projectId=${projectId}`, { headers: headers() });
    if (!res.ok) await readError(res, "Could not read the queue");
    return ((await res.json()).jobs as RawJob[]).map(toJob);
}

export interface EnqueueRequest {
    projectId: number;
    videoProjectId?: number | null;
    kind: JobKind;
    engine: string;
    prompt: string;
    count: number;
    params: Record<string, unknown>;
}

export async function enqueue(request: EnqueueRequest): Promise<GenerationJob[]> {
    const res = await fetch(`${API_URL}/api/generate`, {
        method: "POST", headers: headers(), body: JSON.stringify(request),
    });
    if (!res.ok) await readError(res, "Could not start that");
    return ((await res.json()).jobs as RawJob[]).map(toJob);
}

export async function cancelJob(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/api/generate/${id}/cancel`, { method: "POST", headers: headers() });
    if (!res.ok) await readError(res, "Could not cancel that");
}

/** Takes a finished job off the list. The file it made stays. */
export async function forgetJob(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/api/generate/${id}`, { method: "DELETE", headers: headers() });
    if (!res.ok) await readError(res, "Could not remove that");
}
