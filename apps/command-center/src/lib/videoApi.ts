// Client for apps/server's /api/video routes — Laboratory's Video
// Studio. Same backend and trust model as lib/contentApi.ts, kept
// separate because it's its own feature with its own shapes.

import type { ContentItem } from "./contentApi";

const API_URL = import.meta.env.VITE_KIWI_API_URL ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_KIWI_API_TOKEN ?? "";

export type VideoStage = "idea" | "script" | "recorded" | "transcribing" | "editing" | "published";

export const VIDEO_STAGES: VideoStage[] = ["idea", "script", "recorded", "transcribing", "editing", "published"];

export type TranscriptStatus = "pending" | "processing" | "done" | "failed";

/**
 * What the video is spoken in. "auto" lets whisper detect it and then
 * records what it heard — which matters more than it sounds: whisper's
 * CLI assumes English when nothing is set, so an unset Czech recording
 * gets transcribed as English and comes back as confident nonsense.
 */
export const VIDEO_LANGUAGES: { value: string; label: string }[] = [
    { value: "auto", label: "Detect automatically" },
    { value: "cs", label: "Czech" },
    { value: "sk", label: "Slovak" },
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "pl", label: "Polish" },
];

/** Follow-up pieces a finished video can spawn (its own script aside). */
export type DerivedContentType = "ad" | "instagram-post" | "tiktok-post";

export interface VideoClip {
    start: number; // seconds into the video
    end: number;
    label: string;
    why: string;
    /** Where this clip was cut to on the server, once it has been. */
    file?: string | null;
}

export interface VideoProject {
    id: number;
    title: string;
    stage: VideoStage;
    sourceContentId: number | null;
    sourceVideoPath: string | null;
    transcriptPath: string | null;
    transcriptStatus: TranscriptStatus;
    // Never empty when transcriptStatus is "failed" — the UI shows it
    // verbatim rather than a generic "something went wrong".
    transcriptError: string | null;
    clips: VideoClip[];
    /** "auto", or an ISO 639-1 code. */
    language: string;
    // True only while a job is genuinely running in the server process.
    // Distinct from transcriptStatus === "processing", which can outlive
    // the process that set it if the server dies mid-job.
    transcribing: boolean;
    contentItems: ContentItem[];
    createdAt: string;
    updatedAt: string;
}

interface RawVideoProject {
    id: number;
    title: string;
    stage: VideoStage;
    source_content_id: number | null;
    source_video_path: string | null;
    transcript_path: string | null;
    transcript_status: TranscriptStatus;
    transcript_error: string | null;
    clips_json: string | null;
    language: string;
    transcribing: boolean;
    contentItems: RawContentItem[];
    created_at: string;
    updated_at: string;
}

interface RawContentItem {
    id: number;
    type: ContentItem["type"];
    topic: string;
    content: string;
    status: ContentItem["status"];
    scheduled_date: string | null;
    created_at: string;
}

function toContentItem(raw: RawContentItem): ContentItem {
    return {
        id: raw.id, type: raw.type, topic: raw.topic, content: raw.content,
        status: raw.status, scheduledDate: raw.scheduled_date, created_at: raw.created_at,
    };
}

function toVideoProject(raw: RawVideoProject): VideoProject {
    let clips: VideoClip[] = [];
    if (raw.clips_json) {
        // Stored as text; a malformed value shouldn't take the whole
        // list down, so it degrades to "no clips yet".
        try { clips = JSON.parse(raw.clips_json) as VideoClip[]; } catch { clips = []; }
    }
    return {
        id: raw.id,
        title: raw.title,
        stage: raw.stage,
        sourceContentId: raw.source_content_id,
        sourceVideoPath: raw.source_video_path,
        transcriptPath: raw.transcript_path,
        transcriptStatus: raw.transcript_status,
        transcriptError: raw.transcript_error,
        clips,
        language: raw.language ?? "auto",
        transcribing: Boolean(raw.transcribing),
        contentItems: (raw.contentItems ?? []).map(toContentItem),
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
    };
}

/**
 * Thrown when the backend is reachable but a required piece of setup
 * isn't done (no Anthropic key, no ffmpeg/whisper) — the message is
 * written to be shown as-is, since it says exactly what to install or
 * set. Distinct from a generic failure so the UI can present it as a
 * setup step rather than an error.
 */
export class VideoNotConfiguredError extends Error {}

/**
 * Thrown for 409 — the step was refused because an earlier one isn't
 * done (or a job is already running). The UI disables these buttons
 * anyway; this is what catches the cases where a button was clicked
 * just as the state changed underneath it.
 */
export class VideoStepBlockedError extends Error {}

function headers(): HeadersInit {
    return {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    };
}

async function readError(res: Response, fallback: string): Promise<never> {
    const data = await res.json().catch(() => null);
    const message = data?.error ?? `${fallback}: ${res.status}`;
    if (res.status === 503) throw new VideoNotConfiguredError(message);
    if (res.status === 409) throw new VideoStepBlockedError(message);
    throw new Error(message);
}

export async function fetchVideoProjects(): Promise<VideoProject[]> {
    const res = await fetch(`${API_URL}/api/video`, { headers: headers() });
    if (!res.ok) await readError(res, "Could not load video projects");
    const data = await res.json();
    return ((data.projects ?? []) as RawVideoProject[]).map(toVideoProject);
}

export async function createVideoProject(title: string): Promise<VideoProject> {
    const res = await fetch(`${API_URL}/api/video`, {
        method: "POST", headers: headers(), body: JSON.stringify({ title }),
    });
    if (!res.ok) await readError(res, "Could not create the project");
    return toVideoProject((await res.json()).project);
}

export interface VideoProjectUpdate {
    title?: string;
    stage?: VideoStage;
    // null clears it; omitted means "don't touch".
    sourceVideoPath?: string | null;
    language?: string;
}

export async function updateVideoProject(id: number, update: VideoProjectUpdate): Promise<VideoProject> {
    const res = await fetch(`${API_URL}/api/video/${id}`, {
        method: "PATCH", headers: headers(), body: JSON.stringify(update),
    });
    if (!res.ok) await readError(res, "Could not save");
    return toVideoProject((await res.json()).project);
}

export async function deleteVideoProject(id: number): Promise<void> {
    await fetch(`${API_URL}/api/video/${id}`, { method: "DELETE", headers: headers() });
}

export async function generateVideoScript(id: number, brief: string): Promise<VideoProject> {
    const res = await fetch(`${API_URL}/api/video/${id}/script`, {
        method: "POST", headers: headers(), body: JSON.stringify({ brief }),
    });
    if (!res.ok) await readError(res, "Could not draft a script");
    return toVideoProject((await res.json()).project);
}

/** Returns the project as it stands the moment the job was accepted. */
export async function startTranscription(id: number): Promise<VideoProject> {
    const res = await fetch(`${API_URL}/api/video/${id}/transcribe`, { method: "POST", headers: headers() });
    if (!res.ok) await readError(res, "Could not start the transcription");
    return toVideoProject((await res.json()).project);
}

export async function findVideoClips(id: number): Promise<VideoProject> {
    const res = await fetch(`${API_URL}/api/video/${id}/clips`, { method: "POST", headers: headers() });
    if (!res.ok) await readError(res, "Could not find clips");
    return toVideoProject((await res.json()).project);
}

export async function cutVideoClip(id: number, index: number): Promise<VideoProject> {
    const res = await fetch(`${API_URL}/api/video/${id}/clips/${index}/cut`, { method: "POST", headers: headers() });
    if (!res.ok) await readError(res, "Could not cut that clip");
    return toVideoProject((await res.json()).project);
}

export async function generateDerivedContent(id: number, type: DerivedContentType): Promise<VideoProject> {
    const res = await fetch(`${API_URL}/api/video/${id}/content`, {
        method: "POST", headers: headers(), body: JSON.stringify({ type }),
    });
    if (!res.ok) await readError(res, "Could not generate that piece");
    return toVideoProject((await res.json()).project);
}
