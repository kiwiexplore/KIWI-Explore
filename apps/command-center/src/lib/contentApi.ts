// Client for apps/server's /api/content routes — Laboratory's Content
// Hub (AI-generated YouTube scripts / IG / TikTok posts). Same
// backend, same trust model as lib/kiwiApi.ts; kept separate since this
// is a distinct feature (Laboratory-only) from the Dashboard's Hey Kiwi
// chat, not because the underlying transport differs.

const API_URL = import.meta.env.VITE_KIWI_API_URL ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_KIWI_API_TOKEN ?? "";

// 'ad' pieces are produced by Video Studio (POST /api/video/:id/content),
// not by this file's own generate call — but they land in the same
// content_items table, so anything listing content has to render them.
export type ContentType = "youtube-script" | "instagram-post" | "tiktok-post" | "facebook-post" | "ad";

// What Content Hub's own Generate form can ask for. Narrower than
// ContentType on purpose: the server's /api/content/generate only knows
// the three topic-driven kinds, since an ad needs a video to promote.
export type GeneratableContentType = Exclude<ContentType, "ad">;
export type ContentStatus = "idea" | "scheduled" | "published";

export interface ContentItem {
    id: number;
    type: ContentType;
    topic: string;
    content: string;
    status: ContentStatus;
    scheduledDate: string | null;
    /**
     * Ticked off. A piece that exists is work started; a piece you have
     * ticked is work finished — and only the second turns a stage
     * green, or drafting one empty script would call CREATE done.
     */
    done: boolean;
    /** Which video it was written for, or null. */
    videoProjectId: number | null;
    created_at: string;
}

interface RawContentItem {
    id: number;
    type: ContentType;
    done?: number | boolean;
    video_project_id?: number | null;
    topic: string;
    content: string;
    status: ContentStatus;
    scheduled_date: string | null;
    created_at: string;
}

function toContentItem(raw: RawContentItem): ContentItem {
    return {
        id: raw.id, type: raw.type, topic: raw.topic, content: raw.content,
        status: raw.status, scheduledDate: raw.scheduled_date, created_at: raw.created_at,
        done: raw.done === 1 || raw.done === true,
        videoProjectId: raw.video_project_id ?? null,
    };
}

// Thrown distinctly so the UI can say "set your Anthropic key" instead
// of a generic network-failure message.
export class ContentNotConfiguredError extends Error {}

function headers(): HeadersInit {
    return {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    };
}

export async function fetchContentItems(): Promise<ContentItem[]> {
    const res = await fetch(`${API_URL}/api/content`, { headers: headers() });
    if (!res.ok) throw new Error(`Could not load content: ${res.status}`);
    const data = await res.json();
    return ((data.items ?? []) as RawContentItem[]).map(toContentItem);
}

export async function generateContentItem(type: GeneratableContentType, topic: string): Promise<ContentItem> {
    const res = await fetch(`${API_URL}/api/content/generate`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ type, topic }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 503) throw new ContentNotConfiguredError(data?.error ?? "Kiwi's backend isn't fully configured yet.");
    if (!res.ok) throw new Error(data?.error ?? `Could not generate content: ${res.status}`);
    return toContentItem(data.item);
}

/** Writes a piece by hand, instead of asking for one. */
export async function createContentItem(
    type: ContentType, topic: string, content = "", videoProjectId?: number,
): Promise<ContentItem> {
    const res = await fetch(`${API_URL}/api/content`, {
        method: "POST", headers: headers(), body: JSON.stringify({ type, topic, content, videoProjectId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? `Could not save that: ${res.status}`);
    return toContentItem(data.item);
}

export interface ContentItemUpdate {
    status?: ContentStatus;
    /** The words themselves. */
    content?: string;
    topic?: string;
    // null explicitly clears the scheduled date; omitted means "don't touch it".
    scheduledDate?: string | null;
    done?: boolean;
    /** null takes it off a video without deleting it. */
    videoProjectId?: number | null;
}

export async function updateContentItem(id: number, update: ContentItemUpdate): Promise<ContentItem> {
    const res = await fetch(`${API_URL}/api/content/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(update),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? `Could not update content: ${res.status}`);
    return toContentItem(data.item);
}

export async function deleteContentItem(id: number): Promise<void> {
    await fetch(`${API_URL}/api/content/${id}`, { method: "DELETE", headers: headers() });
}
