import "dotenv/config";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";
import { spotifyRouter } from "./routes/spotify.js";
import { memoriesRouter } from "./routes/memories.js";
import { googleRouter } from "./routes/google.js";
import { calendarRouter } from "./routes/calendar.js";
import { youtubeRouter } from "./routes/youtube.js";
import { gmailRouter } from "./routes/gmail.js";
import { contentRouter } from "./routes/content.js";
import { analysisRouter } from "./routes/analysis.js";
import { videoRouter } from "./routes/video.js";
import { failInterruptedTranscripts } from "./db.js";

const PORT = Number(process.env.PORT) || 8787;
// KIWI_API_TOKEN is optional on purpose — this is a personal-mode,
// single-owner backend meant to run privately (your own machine, or a
// deployment only you have the address to). Set it once you deploy
// somewhere less private; until then the app just runs unauthenticated,
// same trust model as the Spotify Client ID already shipped client-side.
const API_TOKEN = process.env.KIWI_API_TOKEN;

const app = express();
app.use(express.json());

// Vite's dev server picks a random port when the default is taken (see
// apps/command-center/vite.config.ts) — allow any localhost/127.0.0.1
// origin in dev rather than hardcoding one port that keeps drifting.
// CORS_ORIGIN pins this down to a real origin for anything else
// (a real deployment).
const configuredOrigin = process.env.CORS_ORIGIN;
app.use(cors({
    origin(origin, callback) {
        if (!origin) { callback(null, true); return; }
        if (configuredOrigin) { callback(null, origin === configuredOrigin); return; }
        callback(null, /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
    },
}));

app.get("/api/health", (_req, res) => {
    res.json({ ok: true, anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

if (API_TOKEN) {
    // /google/authorize and /callback are hit by a plain browser
    // redirect (Google → this backend), which can't attach a bearer
    // token — excluded so setting KIWI_API_TOKEN can't break the OAuth
    // round trip. Every other /api route still needs it.
    app.use("/api", (req, res, next) => {
        if (req.path === "/google/authorize" || req.path === "/google/callback") { next(); return; }
        if (req.header("Authorization") === `Bearer ${API_TOKEN}`) { next(); return; }
        res.status(401).json({ error: "Missing or invalid API token." });
    });
}

app.use("/api/chat", chatRouter);
app.use("/api/spotify", spotifyRouter);
app.use("/api/memories", memoriesRouter);
app.use("/api/google", googleRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/youtube", youtubeRouter);
app.use("/api/gmail", gmailRouter);
app.use("/api/content", contentRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/video", videoRouter);

// A crash or a restart mid-transcription leaves rows claiming to be
// 'processing' with nothing behind them, and Video Studio would spin on
// them forever. Sweeping them into 'failed' at boot is what keeps
// 'processing' from becoming a silent failure state.
const sweptTranscripts = failInterruptedTranscripts();

app.listen(PORT, () => {
    console.log(`KIWI backend listening on http://localhost:${PORT}`);
    if (sweptTranscripts > 0) {
        console.warn(`${sweptTranscripts} transcription(s) were interrupted by a previous shutdown — marked failed so they show up in Video Studio.`);
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn("ANTHROPIC_API_KEY isn't set — /api/chat will respond with a clear 'not configured' error until you add it to apps/server/.env.");
    }
    if (!process.env.SPOTIFY_CLIENT_ID) {
        console.warn("SPOTIFY_CLIENT_ID isn't set — /api/spotify/token will respond with a clear 'not configured' error until you add it to apps/server/.env.");
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET aren't set — Google Calendar/YouTube will respond with a clear 'not configured' error until you add them to apps/server/.env.");
    }
});
