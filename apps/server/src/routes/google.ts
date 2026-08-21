import { Router } from "express";
import { buildGoogleAuthorizeUrl, disconnectGoogle, exchangeGoogleCode, isGoogleConnected, GoogleNotConfiguredError } from "../google.js";

// Shared connect/status/disconnect for Google (covers both Calendar and
// YouTube — see google.ts's own comment). Unlike Spotify's PKCE flow,
// the whole code→token exchange happens here server-side (authorize
// and callback are hit by a plain browser redirect, not fetch — see
// index.ts's auth middleware, which deliberately excludes these two
// routes so KIWI_API_TOKEN, when set, can't break the redirect).
export const googleRouter = Router();

googleRouter.get("/status", (_req, res) => {
    res.json({ connected: isGoogleConnected() });
});

// `returnTo` is this session's frontend origin — carried through
// Google's own `state` param so the callback below knows where to send
// the browser back, without hardcoding one frontend URL (Vite's dev
// server picks a random port when 5173 is taken).
googleRouter.get("/authorize", (req, res) => {
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : null;
    if (!returnTo) {
        res.status(400).send("Missing returnTo query parameter.");
        return;
    }
    try {
        res.redirect(buildGoogleAuthorizeUrl(returnTo));
    } catch (e) {
        if (e instanceof GoogleNotConfiguredError) {
            res.status(503).send(e.message);
            return;
        }
        throw e;
    }
});

googleRouter.get("/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const returnTo = typeof req.query.state === "string" ? req.query.state : null;
    if (!code || !returnTo) {
        res.status(400).send("Google's redirect was missing code/state.");
        return;
    }
    try {
        await exchangeGoogleCode(code);
        res.redirect(returnTo);
    } catch (e) {
        console.error("Google OAuth callback failed:", e);
        const message = e instanceof Error ? e.message : "Could not connect Google.";
        const separator = returnTo.includes("?") ? "&" : "?";
        res.redirect(`${returnTo}${separator}googleError=${encodeURIComponent(message)}`);
    }
});

googleRouter.delete("/", (_req, res) => {
    disconnectGoogle();
    res.status(204).end();
});
