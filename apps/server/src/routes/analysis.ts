import { Router } from "express";
import { z } from "zod";
import { generateTrendAnalysis, generateMarketAnalysis, AnthropicNotConfiguredError } from "../analysisGenerator.js";

export const analysisRouter = Router();

const topicBodySchema = z.object({ topic: z.string().trim().min(1).max(300) });
const queryBodySchema = z.object({ query: z.string().trim().min(1).max(300) });

analysisRouter.post("/trend", async (req, res) => {
    const parsed = topicBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "topic is required." });
        return;
    }
    try {
        const result = await generateTrendAnalysis(parsed.data.topic);
        res.json({ result });
    } catch (e) {
        if (e instanceof AnthropicNotConfiguredError) {
            res.status(503).json({ error: e.message });
            return;
        }
        console.error("Trend analysis failed:", e);
        res.status(502).json({ error: e instanceof Error ? e.message : "Could not generate trend analysis." });
    }
});

analysisRouter.post("/market", async (req, res) => {
    const parsed = queryBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "query is required." });
        return;
    }
    try {
        const result = await generateMarketAnalysis(parsed.data.query);
        res.json({ result });
    } catch (e) {
        if (e instanceof AnthropicNotConfiguredError) {
            res.status(503).json({ error: e.message });
            return;
        }
        console.error("Market analysis failed:", e);
        res.status(502).json({ error: e instanceof Error ? e.message : "Could not generate market analysis." });
    }
});
