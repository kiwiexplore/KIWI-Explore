import { getClient, AnthropicNotConfiguredError } from "./anthropic.js";

/**
 * The model-backed steps of Video Studio's pipeline: draft a script,
 * find clip-worthy moments in a transcript, and write the ads/social
 * posts that go out with a finished video.
 *
 * Same one-shot shape as contentGenerator.ts (no conversation, no
 * memory) and the same re-export of AnthropicNotConfiguredError so a
 * route only needs one import to handle both error paths. Kept separate
 * from that file because these prompts all take a video's own material
 * as input rather than just a topic string.
 */
export { AnthropicNotConfiguredError };

// The kinds of follow-up piece a finished video can spawn. Matches the
// widened content_items type enum minus 'youtube-script', which is the
// video's own script rather than something derived from it.
export type DerivedContentType = "ad" | "instagram-post" | "tiktok-post";

export const DERIVED_CONTENT_TYPES: DerivedContentType[] = ["ad", "instagram-post", "tiktok-post"];

const LANGUAGE_NAMES: Record<string, string> = {
    cs: "Czech", sk: "Slovak", en: "English", de: "German", pl: "Polish",
    es: "Spanish", fr: "French", it: "Italian", uk: "Ukrainian",
};

/**
 * The line that decides what language the output comes back in.
 *
 * Without it, an English prompt gets an English answer — wrong for
 * anybody whose videos aren't in English. These prompts are written in
 * English because that's what the model reads best, not because the
 * script should be.
 *
 * 'auto' deliberately says nothing beyond "match the material": with a
 * transcript in hand that's the right guess, and guessing a language
 * outright would be worse than following what was actually said.
 */
function languageInstruction(language: string): string {
    if (!language || language === "auto") return "\n\nWrite it in the same language as the material above.";
    return "\n\nWrite it in " + (LANGUAGE_NAMES[language] ?? language) + ".";
}

/** How to name the language inside a prompt sentence. */
function languageName(language: string): string {
    if (!language || language === "auto") return "the same language as the transcript";
    return LANGUAGE_NAMES[language] ?? language;
}

async function ask(prompt: string, maxTokens = 1500): Promise<string> {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text ?? "";
}

export async function generateVideoScript(title: string, brief: string, language: string): Promise<string> {
    return ask(`Write a video script for a video titled "${title}".${brief ? `\n\nWhat it should cover:\n${brief}` : ""}

Structure it as:
- Hook (the first 10-15 seconds — why someone keeps watching)
- The main sections, each with what to actually say and roughly how long to spend
- Call to action to close on

Write it to be recorded from, not read as an essay. Plain text, no markdown headers.` + languageInstruction(language));
}

export interface VideoClip {
    start: number; // seconds into the video
    end: number;
    label: string;
    why: string;
}

/**
 * Asks for clip-worthy moments as JSON so the UI can render real
 * timestamps rather than a wall of prose. A response that doesn't parse
 * throws rather than being half-salvaged — a clip list with invented
 * timestamps would be worse than no clip list.
 */
export async function findVideoClips(
    title: string,
    segments: { start: number; end: number; text: string }[],
    fallbackTranscript: string,
    language: string,
): Promise<VideoClip[]> {
    // Timestamped segments are what makes a clip cuttable. When whisper's
    // JSON is missing (see readTranscriptSegments) the plain transcript
    // still lets the model pick moments, but it can only guess at times —
    // so it's told to, rather than quietly making numbers up.
    const body = segments.length > 0
        ? `Transcript with timestamps (seconds):\n${segments.map((s) => `[${s.start}-${s.end}] ${s.text}`).join("\n")}`
        : `Transcript (no timestamps available, so estimate the times and keep them conservative):\n${fallbackTranscript}`;

    const raw = await ask(`From this transcript of a video titled "${title}", pick the 3-6 moments that would work best as standalone short clips.

${body}

Respond with ONLY a JSON array, no prose around it, in this exact shape:
[{"start": 12, "end": 47, "label": "short title for the clip", "why": "one sentence on why this moment works alone"}]

start and end are whole seconds from the beginning of the video. Write label and why in ` + languageName(language) + `.`, 2000);

    // Models sometimes wrap JSON in a code fence even when told not to.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error("The clip suggestions came back in a form this couldn't read. Try again.");
    }
    if (!Array.isArray(parsed)) throw new Error("The clip suggestions came back in an unexpected shape. Try again.");

    return parsed
        .map((clip) => clip as Partial<VideoClip>)
        .filter((clip) => typeof clip.start === "number" && typeof clip.end === "number")
        .map((clip) => ({
            start: Math.max(0, Math.round(clip.start as number)),
            end: Math.max(0, Math.round(clip.end as number)),
            label: String(clip.label ?? "Untitled clip"),
            why: String(clip.why ?? ""),
        }));
}

const DERIVED_PROMPTS: Record<DerivedContentType, (title: string, material: string) => string> = {
    ad: (title, material) => `Write a short paid ad promoting a video titled "${title}".

What the video actually contains:
${material}

Give a primary text (under ~90 words), a headline (under 40 characters), and a one-line description. Label each. Sell the video, don't restate it.`,
    "instagram-post": (title, material) => `Write an Instagram caption promoting a video titled "${title}".

What the video actually contains:
${material}

Under ~150 words, end with a call to action pointing at the full video, and put 5-8 relevant hashtags on their own line at the end.`,
    "tiktok-post": (title, material) => `Write a TikTok caption and on-screen text for a short cut from a video titled "${title}".

What the video actually contains:
${material}

Hook in the first 3 seconds, keep it punchy, and finish with 3-5 hashtags.`,
};

/**
 * `material` is the video's transcript when there is one, otherwise its
 * script — deriving an ad from what was actually said beats deriving it
 * from what was planned, but either is far better than the title alone.
 */
export async function generateDerivedContent(
    type: DerivedContentType, title: string, material: string, language: string,
): Promise<string> {
    return ask(DERIVED_PROMPTS[type](title, material) + languageInstruction(language), 1024);
}
