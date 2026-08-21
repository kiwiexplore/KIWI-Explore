import { clearSpotifyTokens, getSpotifyTokens, saveSpotifyTokens, type StoredSpotifyTokens } from "./db.js";

// Server-side half of the PKCE flow apps/command-center/src/lib/spotifyAuth.ts
// already implements client-side. The initial code→token exchange still
// happens in the browser (it already worked, no reason to duplicate the
// redirect dance server-side) — this only takes over from there:
// storing the result and refreshing it on demand, so the connection
// lives on the backend instead of only in one browser's localStorage.
// Refreshing needs no client secret (same PKCE property that makes the
// browser-side exchange safe), just the same Client ID.

export class SpotifyNotConnectedError extends Error {}

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    error?: string;
    error_description?: string;
}

async function refresh(clientId: string, refreshToken: string): Promise<StoredSpotifyTokens> {
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId }),
    });
    const data = (await res.json()) as TokenResponse;
    if (!res.ok || !data.access_token) {
        throw new Error(data.error_description ?? data.error ?? `Spotify token refresh failed: ${res.status}`);
    }
    return {
        accessToken: data.access_token,
        // Spotify only sends a new refresh_token sometimes — keep the
        // old one when this response didn't include a fresh one.
        refreshToken: data.refresh_token ?? refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
}

export function storeInitialTokens(tokens: StoredSpotifyTokens): void {
    saveSpotifyTokens(tokens);
}

export function disconnectSpotify(): void {
    clearSpotifyTokens();
}

export function isSpotifyConnected(): boolean {
    return getSpotifyTokens() !== null;
}

// Returns a definitely-fresh access token, refreshing and persisting the
// result first if the stored one is close to expiring.
export async function getValidSpotifyAccessToken(clientId: string): Promise<string> {
    const current = getSpotifyTokens();
    if (!current) throw new SpotifyNotConnectedError("Spotify isn't connected yet.");
    if (Date.now() < current.expiresAt - 30_000) return current.accessToken;
    const refreshed = await refresh(clientId, current.refreshToken);
    saveSpotifyTokens(refreshed);
    return refreshed.accessToken;
}
