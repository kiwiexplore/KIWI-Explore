// Spotify Web API — reads/controls whatever is currently playing on
// the user's account (any active device: phone, desktop app, another
// browser), not audio streamed by this app itself. That's a
// deliberate scope choice over also standing up the Web Playback SDK
// as an in-browser device: controlling existing playback needs only
// these REST calls, works everywhere immediately, and is what "play
// music from KIWI" most often means in practice.

export interface CurrentPlayback {
    isPlaying: boolean;
    trackName: string;
    artistName: string;
    albumArt: string;
    deviceName: string;
}

// Thrown distinctly from other errors so the UI can show "open Spotify
// somewhere and start playing" instead of a generic failure — Spotify
// returns 404 for both "nothing playing" and "no active device".
export class NoActiveDeviceError extends Error {}

async function spotifyFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    if (res.status === 401) throw new Error("Spotify session expired — reconnect.");
    if (res.status === 404) throw new NoActiveDeviceError("No active Spotify device — open Spotify and start playing something.");
    if (!res.ok && res.status !== 204) throw new Error(`Spotify API request failed: ${res.status}`);
    return res;
}

export async function fetchCurrentPlayback(token: string): Promise<CurrentPlayback | null> {
    const res = await spotifyFetch(token, "/me/player");
    if (res.status === 204) return null;
    const data = await res.json();
    if (!data?.item) return null;
    return {
        isPlaying: Boolean(data.is_playing),
        trackName: data.item.name,
        artistName: (data.item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
        albumArt: data.item.album?.images?.[0]?.url ?? "",
        deviceName: data.device?.name ?? "",
    };
}

export function play(token: string): Promise<Response> {
    return spotifyFetch(token, "/me/player/play", { method: "PUT" });
}

export function pause(token: string): Promise<Response> {
    return spotifyFetch(token, "/me/player/pause", { method: "PUT" });
}

export function nextTrack(token: string): Promise<Response> {
    return spotifyFetch(token, "/me/player/next", { method: "POST" });
}

export function previousTrack(token: string): Promise<Response> {
    return spotifyFetch(token, "/me/player/previous", { method: "POST" });
}
