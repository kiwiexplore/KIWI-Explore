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

/**
 * A piece written by hand rather than generated.
 *
 * Scripts were read-only until now: the only way to get one was to ask
 * for it, and the only thing you could do with the answer was look at
 * it. That is the wrong shape for the one artefact you are most likely
 * to want to change — a draft is a starting point, not a delivery.
 */
const createBodySchema = z.object({
    type: z.enum(CONTENT_TYPES as [string, ...string[]]),
    topic: z.string().trim().min(1).max(300),
    content: z.string().max(200_000).default(""),
    videoProjectId: z.number().int().nullable().optional(),
});

contentRouter.post("/", (req, res) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "type and topic are required." });
        return;
    }
    const { type, topic, content, videoProjectId } = parsed.data;
    const item = insertContentItem(
        type as (typeof CONTENT_TYPES)[number], topic, content, videoProjectId ?? null,
    );
    res.json({ item });
});

const updateBodySchema = z.object({
    status: z.enum(["idea", "scheduled", "published"]).optional(),
    // null explicitly clears the scheduled date; omitted means "don't touch it".
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    content: z.string().max(200_000).optional(),
    topic: z.string().trim().min(1).max(300).optional(),
});

contentRouter.patch("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const parsed = updateBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid status/scheduledDate/content." });
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
