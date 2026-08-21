import Anthropic from "@anthropic-ai/sdk";
import type { StoredMessage, StoredMemory } from "./db.js";

// Thrown when ANTHROPIC_API_KEY isn't set — distinct from other errors
// so the route can return a clear "not configured yet" response instead
// of a generic 500, since this is the one setup step only the account
// owner can do (an Anthropic API key from their own console.anthropic.com
// account — not something this session can create on their behalf).
export class AnthropicNotConfiguredError extends Error {}

const SYSTEM_PROMPT = `You are Kiwi, the AI orchestrator inside KIWI Explore — a personal AI operating system / dashboard the user is building for themselves. You're the conversational core they talk to from the "Hey Kiwi" bar. Be direct, warm, and concise — this is a chat bubble in a dashboard, not an essay. You don't have any tools wired up yet, so don't claim to check calendars, send messages, or control anything outside this conversation — if asked to do something like that, say plainly that you're not connected to it yet.`;

let client: Anthropic | null = null;

// Exported — content.ts's generator reuses the same client/config
// rather than duplicating the API key check.
export function getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new AnthropicNotConfiguredError("ANTHROPIC_API_KEY isn't set in apps/server/.env yet.");
    if (!client) client = new Anthropic({ apiKey });
    return client;
}

function buildSystemPrompt(memories: StoredMemory[]): string {
    if (memories.length === 0) return SYSTEM_PROMPT;
    const facts = memories.map((m) => `- ${m.fact}`).join("\n");
    return `${SYSTEM_PROMPT}\n\nThings you already know about the user from past conversations:\n${facts}`;
}

export async function askKiwi(history: StoredMessage[], memories: StoredMemory[] = []): Promise<string> {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: buildSystemPrompt(memories),
        messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text ?? "";
}
