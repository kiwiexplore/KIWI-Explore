import { Router } from "express";
import { getValidGoogleAccessToken, GoogleNotConnectedError, GoogleNotConfiguredError } from "../google.js";

export const youtubeRouter = Router();

export interface YouTubeChannel {
    title: string;
    thumbnailUrl: string;
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
}

interface RawChannelsResponse {
    items?: {
        snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
        statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    }[];
}

youtubeRouter.get("/channel", async (_req, res) => {
    try {
        const accessToken = await getValidGoogleAccessToken();
        const params = new URLSearchParams({ part: "snippet,statistics", mine: "true" });
        const apiRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!apiRes.ok) {
            const body = await apiRes.text().catch(() => "");
            throw new Error(`YouTube API request failed: ${apiRes.status} ${body}`.trim());
        }
        const data = (await apiRes.json()) as RawChannelsResponse;
        const item = data.items?.[0];
        if (!item) {
            res.json({ channel: null });
            return;
        }
        const channel: YouTubeChannel = {
            title: item.snippet?.title || "(untitled channel)",
            thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? "",
            subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
            viewCount: Number(item.statistics?.viewCount ?? 0),
            videoCount: Number(item.statistics?.videoCount ?? 0),
        };
        res.json({ channel });
    } catch (e) {
        if (e instanceof GoogleNotConnectedError) {
            res.status(404).json({ error: e.message });
            return;
        }
        if (e instanceof GoogleNotConfiguredError) {
            res.status(503).json({ error: e.message });
            return;
        }
        console.error("Fetching YouTube channel failed:", e);
        res.status(502).json({ error: e instanceof Error ? e.message : "Could not reach YouTube." });
    }
});
