import Anthropic from "@anthropic-ai/sdk";
import { insertMemory, listMemories, type StoredMemory } from "./db.js";

// Kiwi's cross-session memory: rather than resending the full message
// history forever (cost/context-limit reasons — see PROJECT_CONTEXT),
// durable facts about the user get extracted once and kept in the
// `memories` table, then folded into every future chat's system prompt
// (see anthropic.ts's askKiwi). Runs as a fire-and-forget background
// call after each reply (see routes/chat.ts) — it never blocks or can
// fail the actual chat response.

const EXTRACTION_PROMPT = `You extract durable, worth-remembering facts from a single exchange between a user and Kiwi, an AI assistant. Durable means: still true and useful weeks from now (preferences, ongoing projects, personal details, recurring context) — NOT small talk, NOT anything already in the "already known" list below, NOT the assistant's own replies.

Respond with one fact per line, no numbering or bullets, each a short standalone sentence. If nothing new and durable is worth remembering, respond with exactly: NONE`;

function buildPrompt(userText: string, assistantText: string, existing: StoredMemory[]): string {
    const known = existing.length
        ? `Already known about the user:\n${existing.map((m) => `- ${m.fact}`).join("\n")}\n\n`
        : "";
    return `${known}New exchange:\nUser: ${userText}\nKiwi: ${assistantText}`;
}

export async function extractAndStoreMemories(userText: string, assistantText: string): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return; // Same "not configured" case askKiwi handles — just skip quietly here.

    const existing = listMemories();
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: EXTRACTION_PROMPT,
        messages: [{ role: "user", content: buildPrompt(userText, assistantText, existing) }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.text?.trim() ?? "";
    if (!text || text === "NONE") return;

    for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
        insertMemory(line);
    }
}
