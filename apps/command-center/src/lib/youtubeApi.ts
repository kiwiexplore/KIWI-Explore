// Client for apps/server's /api/youtube — the channel's own numbers,
// read through the Google account the backend is connected to.

const API_URL = import.meta.env.VITE_KIWI_API_URL ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_KIWI_API_TOKEN ?? "";

export interface YouTubeChannel {
    title: string;
    thumbnailUrl: string;
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
}

/**
 * Why the numbers aren't there, told apart.
 *
 * "Not configured" is a thing only the account owner can fix and needs
 * a different sentence from "not connected", which is one button. A
 * single "unavailable" would send you looking in the wrong place.
 */
export type YouTubeState =
    | { status: "ok"; channel: YouTubeChannel }
    | { status: "no-channel" }
    | { status: "not-connected" }
    | { status: "not-configured"; message: string }
    | { status: "error"; message: string };

function headers(): HeadersInit {
    return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
}

/**
 * Where the browser goes to hand the backend a Google account.
 *
 * `returnTo` is this page's own origin, carried through Google's state
 * param so the callback knows where to send the browser back — Vite
 * picks a different port when 5173 is taken, so it cannot be a
 * constant. The route refuses the request without it.
 */
export function youtubeConnectUrl(): string {
    return `${API_URL}/api/google/authorize?returnTo=${encodeURIComponent(window.location.origin)}`;
}

/** Whether the backend even has Google credentials to connect with. */
async function googleConfigured(): Promise<boolean> {
    try {
        const res = await fetch(`${API_URL}/api/google/status`, { headers: headers() });
        if (!res.ok) return false;
        return Boolean((await res.json()).configured);
    } catch {
        return false;
    }
}

export async function fetchYouTubeChannel(): Promise<YouTubeState> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/api/youtube/channel`, { headers: headers() });
    } catch {
        // The backend being down is not a YouTube problem and must not
        // be reported as one.
        return { status: "error", message: "Can't reach the KIWI backend." };
    }

    if (res.status === 404) {
        // "Not connected" only means one button when there is something
        // to connect to. Without credentials on the backend, pressing it
        // would land on a 503 — so ask first, and say the true thing.
        return (await googleConfigured())
            ? { status: "not-connected" }
            : {
                status: "not-configured",
                message: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI aren't set in apps/server/.env yet.",
            };
    }
    if (res.status === 503) {
        const data = await res.json().catch(() => null);
        return { status: "not-configured", message: data?.error ?? "Google isn't set up on the backend yet." };
    }
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        return { status: "error", message: data?.error ?? `YouTube said ${res.status}.` };
    }

    const data = await res.json();
    if (!data.channel) return { status: "no-channel" };
    return { status: "ok", channel: data.channel as YouTubeChannel };
}

/** 12345 → 12.3K. Big numbers on a bar are read, not counted. */
export function compact(n: number): string {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
    return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
}
