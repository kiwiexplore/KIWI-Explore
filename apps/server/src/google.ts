import { clearOAuthTokens, getOAuthTokens, saveOAuthTokens, type StoredOAuthTokens } from "./db.js";

// One Google OAuth connection covers both Calendar and YouTube (see
// routes/google.ts, routes/calendar.ts, routes/youtube.ts) — both are
// Google APIs, so one consent screen requesting both scopes at once
// means one connect flow instead of two. Standard server-side
// Authorization Code flow (not PKCE like Spotify): this backend holds
// a real client secret, which Google's "Web application" client type
// expects and Spotify's PKCE flow deliberately avoided needing.

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export class GoogleNotConnectedError extends Error {}
export class GoogleNotConfiguredError extends Error {}

interface GoogleClientConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export function getGoogleConfig(): GoogleClientConfig {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        throw new GoogleNotConfiguredError("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI aren't all set in apps/server/.env yet.");
    }
    return { clientId, clientSecret, redirectUri };
}

/**
 * Whether the credentials exist at all, without throwing.
 *
 * "Nobody has set this up" and "nobody has signed in" need different
 * sentences and different actions, and a screen that can only say
 * "unavailable" sends you looking in the wrong place.
 */
export function isGoogleConfigured(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function buildGoogleAuthorizeUrl(state: string): string {
    const config = getGoogleConfig();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: GOOGLE_SCOPES,
        access_type: "offline", // required to get a refresh_token back
        prompt: "consent", // ...and to get one on every re-consent, not just the first ever
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    error?: string;
    error_description?: string;
}

async function requestToken(body: URLSearchParams): Promise<StoredOAuthTokens> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const data = (await res.json()) as TokenResponse;
    if (!res.ok || !data.access_token) {
        throw new Error(data.error_description ?? data.error ?? `Google token request failed: ${res.status}`);
    }
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? "",
        expiresAt: Date.now() + data.expires_in * 1000,
    };
}

export async function exchangeGoogleCode(code: string): Promise<void> {
    const config = getGoogleConfig();
    const tokens = await requestToken(new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
    }));
    if (!tokens.refreshToken) {
        // Happens if the user had already granted consent before and
        // Google skipped issuing a new refresh_token despite prompt=consent
        // — extremely rare with prompt=consent set, but fail loudly rather
        // than silently storing a connection that can't outlive the
        // access token's ~1 hour lifetime.
        throw new Error("Google didn't return a refresh token — try disconnecting any prior KIWI access at myaccount.google.com/permissions and reconnecting.");
    }
    saveOAuthTokens(GOOGLE_PROVIDER, tokens);
}

export function isGoogleConnected(): boolean {
    return getOAuthTokens(GOOGLE_PROVIDER) !== null;
}

export function disconnectGoogle(): void {
    clearOAuthTokens(GOOGLE_PROVIDER);
}

export async function getValidGoogleAccessToken(): Promise<string> {
    const current = getOAuthTokens(GOOGLE_PROVIDER);
    if (!current) throw new GoogleNotConnectedError("Google isn't connected yet.");
    if (Date.now() < current.expiresAt - 30_000) return current.accessToken;
    const config = getGoogleConfig();
    const refreshed = await requestToken(new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
    }));
    // Google's refresh response never includes a new refresh_token —
    // keep reusing the original one, unlike Spotify where this was
    // merely "sometimes".
    const merged: StoredOAuthTokens = { ...refreshed, refreshToken: refreshed.refreshToken || current.refreshToken };
    saveOAuthTokens(GOOGLE_PROVIDER, merged);
    return merged.accessToken;
}
