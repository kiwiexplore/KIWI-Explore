import Anthropic from "@anthropic-ai/sdk";
import { allLiberecStories } from "./liberec.mjs";

/**
 * "What's happening in Liberec today", written by Claude from the day's
 * own headlines.
 *
 * This is the one job in KIWI a model is actually better at than code.
 * Pulling titles out of a feed needs no intelligence — a parser does it
 * faster, cheaper and without ever inventing anything, which is why the
 * news list itself never goes near a model. Reading a hundred headlines
 * from four newsrooms, noticing that three of them covered the same
 * roadworks, and saying what the day amounted to is the part a parser
 * cannot do at all.
 *
 * Everything it writes comes from the headlines and perexes handed to
 * it in the prompt below; nothing is fetched by the model and nothing
 * is remembered between runs. If a source is down its stories are
 * simply absent, and the digest says less rather than filling the gap.
 */

// Claude Opus 5 by default. Overridable because the choice of model is
// a cost decision and cost decisions belong to whoever pays the bill —
// set BRIEF_MODEL=claude-haiku-4-5 for a much cheaper digest.
const MODEL = process.env.BRIEF_MODEL ?? "claude-opus-5";

// How long a digest stands before it's written again. Long, on purpose:
// this is the one endpoint here that costs money per call, and regional
// news does not turn over in minutes.
const TTL_MS = 60 * 60 * 1000;

// How many stories the model is shown. The newest slice of a hundred —
// enough to see the day, short enough to stay a cheap request.
const STORY_LIMIT = 40;

const SYSTEM = `Jsi redaktor, který pro jednoho čtenáře shrnuje dění v Liberci a Libereckém kraji.

Dostaneš dnešní titulky a perexy z několika redakcí. Napiš z nich krátký přehled česky:

- Jeden odstavec, nejvýš pět vět.
- Nejdřív to nejpodstatnější pro člověka, který tu žije — co se ho dotkne.
- Když o jedné věci píše víc redakcí, ber to jako jednu zprávu, ne jako tři.
- Piš jen to, co je v podkladech. Nic nedomýšlej, nedoplňuj čísla ani souvislosti, které tam nejsou.
- Žádný úvod typu "Zde je přehled" a žádný závěr. Rovnou věcně.
- Když jsou podklady chudé, napiš kratší text. Nenatahuj ho.`;

let cached = null;

function storyLines(stories) {
    return stories
        .slice(0, STORY_LIMIT)
        .map((story) => `[${story.source}] ${story.title}${story.summary ? ` — ${story.summary}` : ""}`)
        .join("\n");
}

/**
 * The digest, cached. Returns `configured: false` rather than throwing
 * when there's no API key — the dashboard shows the news list either
 * way, and a missing key is a setup step, not a failure.
 */
export async function liberecBrief() {
    if (!process.env.ANTHROPIC_API_KEY) {
        return { configured: false, brief: "", sources: [], generatedAt: null };
    }
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

    const stories = await allLiberecStories();
    if (stories.length === 0) {
        return { configured: true, brief: "", sources: [], generatedAt: new Date().toISOString() };
    }

    const client = new Anthropic();
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        // A short piece of writing over a fixed set of facts — it needs
        // judgement about what matters, not a long chain of reasoning,
        // so thinking is on but the effort is kept low.
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{
            role: "user",
            content: `Dnešní zprávy z Liberce a Libereckého kraje:\n\n${storyLines(stories)}`,
        }],
    });

    const brief = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text.trim())
        .join("\n\n");

    const value = {
        configured: true,
        brief,
        // Named so the dashboard can credit them under the digest —
        // a summary of someone else's reporting says whose it was.
        sources: [...new Set(stories.slice(0, STORY_LIMIT).map((story) => story.source))],
        storyCount: Math.min(stories.length, STORY_LIMIT),
        model: MODEL,
        generatedAt: new Date().toISOString(),
    };
    cached = { value, at: Date.now() };
    return value;
}
