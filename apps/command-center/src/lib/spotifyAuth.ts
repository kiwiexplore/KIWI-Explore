// Spotify OAuth via Authorization Code with PKCE — the one Spotify
// (and OAuth 2.0 in general) flow designed for browser-only apps: no
// client secret ever touches this code, just a per-attempt random
// "code verifier" whose SHA-256 hash is sent up front and the raw
// value redeemed after redirect. Needs the user's own Spotify
// Developer app (Client ID + this exact redirect URI registered) —
// see state/spotify.ts for how this gets wired up to the UI.
// Reference: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

export const SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";

export function getRedirectUri(): string {
    return `${window.location.origin}/`;
}

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
}

export function generateState(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

export async function buildAuthorizeUrl(clientId: string, codeVerifier: string, state: string): Promise<string> {
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: getRedirectUri(),
        code_challenge_method: "S256",
        code_challenge: codeChallenge,
        scope: SPOTIFY_SCOPES,
        state,
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export interface SpotifyTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // ms epoch
}

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    error?: string;
    error_description?: string;
}

async function requestToken(body: URLSearchParams): Promise<SpotifyTokens> {
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const data: TokenResponse = await res.json();
    if (!res.ok || !data.access_token) {
        throw new Error(data.error_description ?? data.error ?? `Token request failed: ${res.status}`);
    }
    return {
        accessToken: data.access_token,
        // Spotify only returns a new refresh_token sometimes — keep
        // the old one if this response didn't include a fresh one.
        refreshToken: data.refresh_token ?? "",
        expiresAt: Date.now() + data.expires_in * 1000,
    };
}

export function exchangeCodeForTokens(clientId: string, code: string, codeVerifier: string): Promise<SpotifyTokens> {
    return requestToken(new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(),
        client_id: clientId,
        code_verifier: codeVerifier,
    }));
}

export function refreshAccessToken(clientId: string, refreshToken: string): Promise<SpotifyTokens> {
    return requestToken(new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
    }));
}
