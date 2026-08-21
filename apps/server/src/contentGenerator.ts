import { getClient, AnthropicNotConfiguredError } from "./anthropic.js";

export type ContentType = "youtube-script" | "instagram-post" | "tiktok-post";

export const CONTENT_TYPES: ContentType[] = ["youtube-script", "instagram-post", "tiktok-post"];

// One-shot generation, deliberately separate from Kiwi's own chat
// (askKiwi in anthropic.ts) — no conversation history, no memory, just
// "given this topic, write this specific kind of thing". Re-exports
// AnthropicNotConfiguredError so callers only need one import for both
// error-checking paths.
export { AnthropicNotConfiguredError };

const PROMPTS: Record<ContentType, (topic: string) => string> = {
    "youtube-script": (topic) => `Write a YouTube video script outline about: "${topic}".

Structure it as:
- Hook (first 10-15 seconds — why should someone keep watching)
- 3-5 main talking points, each with a one-line note on what to say
- Call to action (what to ask viewers to do at the end)

Keep it practical and ready to record from, not overly formal.`,
    "instagram-post": (topic) => `Write an Instagram caption about: "${topic}".

Keep it engaging and concise (under ~150 words), end with a short call to action, and include 5-8 relevant hashtags on their own line at the end.`,
    "tiktok-post": (topic) => `Write a TikTok video script/caption about: "${topic}".

Hook viewers in the first 3 seconds. Keep it punchy, high-energy, and short (30-60 seconds spoken). Include a short on-screen-text style caption and 3-5 relevant hashtags at the end.`,
};

export async function generateContent(type: ContentType, topic: string): Promise<string> {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: PROMPTS[type](topic) }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text ?? "";
}
