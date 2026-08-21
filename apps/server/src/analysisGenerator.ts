import { getClient, AnthropicNotConfiguredError } from "./anthropic.js";

// One-shot generation, same pattern as contentGenerator.ts — reasoned
// from Claude's own training, not a live web/trend feed, so this is
// real analysis, not real-time monitoring. Honest about that in the
// prompts below rather than pretending to have live data.
export { AnthropicNotConfiguredError };

export async function generateTrendAnalysis(topic: string): Promise<string> {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{
            role: "user",
            content: `Give a trend analysis for: "${topic}".

Cover:
- Current momentum (growing, steady, or fading — and why)
- 2-3 concrete signals or reasons driving that read
- One risk or thing that could change the trajectory
- A one-line takeaway on whether this is worth acting on now

Be concrete and opinionated, not hedged. If you don't have visibility into real-time data, say so briefly rather than inventing numbers. Keep it under 200 words.`,
        }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text ?? "";
}

export async function generateMarketAnalysis(query: string): Promise<string> {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{
            role: "user",
            content: `Answer this market research question: "${query}".

Structure it as:
- Direct answer up front (1-2 sentences)
- Market size/competition context if relevant
- 2-3 supporting points
- One practical next step

Be concrete and opinionated, not hedged. If you don't have visibility into real-time data, say so briefly rather than inventing numbers. Keep it under 200 words.`,
        }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text ?? "";
}
