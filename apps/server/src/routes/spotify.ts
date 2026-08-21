import { Router } from "express";
import { z } from "zod";
import { disconnectSpotify, getValidSpotifyAccessToken, isSpotifyConnected, storeInitialTokens, SpotifyNotConnectedError } from "../spotify.js";

export const spotifyRouter = Router();

function clientId(): string | null {
    return process.env.SPOTIFY_CLIENT_ID || null;
}

spotifyRouter.get("/status", (_req, res) => {
    res.json({ connected: isSpotifyConnected() });
});

const connectBodySchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number(),
});

// Called right after the browser finishes the PKCE code→token exchange
// (see spotifyAuth.ts) — hands the result to the backend to hold onto
// from here on.
spotifyRouter.post("/connect", (req, res) => {
    const parsed = connectBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Missing or invalid Spotify tokens." });
        return;
    }
    storeInitialTokens(parsed.data);
    res.status(204).end();
});

spotifyRouter.get("/token", async (_req, res) => {
    const id = clientId();
    if (!id) {
        res.status(503).json({ error: "SPOTIFY_CLIENT_ID isn't set in apps/server/.env yet." });
        return;
    }
    try {
        const accessToken = await getValidSpotifyAccessToken(id);
        res.json({ accessToken });
    } catch (e) {
        if (e instanceof SpotifyNotConnectedError) {
            res.status(404).json({ error: e.message });
            return;
        }
        console.error("Spotify token refresh failed:", e);
        res.status(502).json({ error: e instanceof Error ? e.message : "Could not refresh the Spotify token." });
    }
});

spotifyRouter.delete("/", (_req, res) => {
    disconnectSpotify();
    res.status(204).end();
});
