// Spotify Web API — reads/controls whatever is currently playing on
// the user's account (any active device: phone, desktop app, KIWI's
// own in-browser device from lib/spotifyPlaybackSdk.ts). Search and
// "play this track" go through these same REST calls; only starting
// playback in-browser needs the separate Web Playback SDK.

export interface CurrentPlayback {
    isPlaying: boolean;
    trackName: string;
    artistName: string;
    albumArt: string;
    deviceName: string;
}

export interface TrackResult {
    uri: string;
    name: string;
    artistName: string;
    albumArt: string;
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

export async function searchTracks(token: string, query: string): Promise<TrackResult[]> {
    if (!query.trim()) return [];
    const params = new URLSearchParams({ q: query, type: "track", limit: "8" });
    const res = await spotifyFetch(token, `/search?${params.toString()}`);
    const data = await res.json();
    interface RawTrack {
        uri: string;
        name: string;
        artists?: { name: string }[];
        album?: { images?: { url: string }[] };
    }
    return ((data?.tracks?.items ?? []) as RawTrack[]).map((t) => ({
        uri: t.uri,
        name: t.name,
        artistName: (t.artists ?? []).map((a) => a.name).join(", "),
        albumArt: t.album?.images?.[t.album.images.length - 1]?.url ?? "",
    }));
}

// Starts a specific track. Passing `deviceId` (KIWI's own Web Playback
// SDK device) makes it play independently of the phone/desktop app;
// omitting it lets Spotify target whatever device is currently active.
export function startTrack(token: string, uri: string, deviceId?: string): Promise<Response> {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
    return spotifyFetch(token, `/me/player/play${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [uri] }),
    });
}

// Explicitly hands the account's active session to `deviceId`. Spotify
// sometimes 404s a play call aimed straight at a device that only just
// registered (its own backend hasn't caught up with the SDK's "ready"
// event yet) — calling this first primes that device as active and
// avoids the race. `play: true` forces Spotify to actually activate the
// device rather than just noting it as a transfer target — a brand-new
// device with no prior session on the account (nothing ever played on
// any device yet) has been observed to need the forceful form; `play:
// false` alone isn't enough to make it a valid target for the follow-up
// play-a-specific-track call. See state/spotify.ts's playTrack.
export function transferPlayback(token: string, deviceId: string): Promise<Response> {
    return spotifyFetch(token, "/me/player", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_ids: [deviceId], play: true }),
    });
}

export interface SpotifyDevice {
    id: string;
    name: string;
}

// Diagnostic only — lets a failed playTrack() report what Spotify's own
// backend currently sees, so "no active device" can be told apart from
// "KIWI registered locally but Spotify never actually listed it."
export async function listDevices(token: string): Promise<SpotifyDevice[]> {
    const res = await spotifyFetch(token, "/me/player/devices");
    const data = await res.json();
    return (data?.devices ?? []) as SpotifyDevice[];
}
