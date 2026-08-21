import { Router } from "express";
import { z } from "zod";
import { clearMessages, insertMessage, listMemories, listMessages } from "../db.js";
import { askKiwi, AnthropicNotConfiguredError } from "../anthropic.js";
import { extractAndStoreMemories } from "../memory.js";

export const chatRouter = Router();

chatRouter.get("/history", (_req, res) => {
    res.json({ messages: listMessages() });
});

const sendBodySchema = z.object({ text: z.string().trim().min(1).max(4000) });

chatRouter.post("/", async (req, res) => {
    const parsed = sendBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Message text is required." });
        return;
    }

    const userMessage = insertMessage("user", parsed.data.text);

    try {
        const reply = await askKiwi(listMessages(), listMemories());
        const assistantMessage = insertMessage("assistant", reply);
        res.json({ userMessage, assistantMessage });
        // Fire-and-forget, after the response is already sent — extracts
        // any new durable facts from this exchange (see memory.ts). Never
        // allowed to affect the chat response itself, success or failure.
        extractAndStoreMemories(parsed.data.text, reply).catch((e) => console.error("Memory extraction failed:", e));
    } catch (e) {
        if (e instanceof AnthropicNotConfiguredError) {
            res.status(503).json({ error: e.message, userMessage });
            return;
        }
        console.error("Kiwi chat failed:", e);
        res.status(502).json({ error: "Kiwi couldn't reach Claude — try again in a moment.", userMessage });
    }
});

chatRouter.delete("/", (_req, res) => {
    clearMessages();
    res.status(204).end();
});
