import { Router } from "express";
import { z } from "zod";
import { deleteContentItem, insertContentItem, listContentItems, updateContentItem } from "../db.js";
import { generateContent, AnthropicNotConfiguredError, CONTENT_TYPES } from "../contentGenerator.js";

export const contentRouter = Router();

contentRouter.get("/", (_req, res) => {
    res.json({ items: listContentItems() });
});

const generateBodySchema = z.object({
    type: z.enum(CONTENT_TYPES as [string, ...string[]]),
    topic: z.string().trim().min(1).max(300),
});

contentRouter.post("/generate", async (req, res) => {
    const parsed = generateBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "type and topic are required." });
        return;
    }
    try {
        const content = await generateContent(parsed.data.type as (typeof CONTENT_TYPES)[number], parsed.data.topic);
        const item = insertContentItem(parsed.data.type as (typeof CONTENT_TYPES)[number], parsed.data.topic, content);
        res.json({ item });
    } catch (e) {
        if (e instanceof AnthropicNotConfiguredError) {
            res.status(503).json({ error: e.message });
            return;
        }
        console.error("Content generation failed:", e);
        res.status(502).json({ error: e instanceof Error ? e.message : "Could not generate content." });
    }
});

const updateBodySchema = z.object({
    status: z.enum(["idea", "scheduled", "published"]).optional(),
    // null explicitly clears the scheduled date; omitted means "don't touch it".
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

contentRouter.patch("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const parsed = updateBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid status/scheduledDate." });
        return;
    }
    const item = updateContentItem(id, parsed.data);
    if (!item) {
        res.status(404).json({ error: "No content item with that id." });
        return;
    }
    res.json({ item });
});

contentRouter.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    deleteContentItem(id);
    res.status(204).end();
});
