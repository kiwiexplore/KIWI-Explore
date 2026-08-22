// World news, through KIWI's own feed service (apps/feed-service).
//
// This read Wikipedia's "In the news" section directly — keyless,
// CORS-enabled, and editorially filtered, which all looked ideal. It
// wasn't: that section is a digest, not a wire. Its handful of items are
// chosen by editors and stay on the front page for days, so the module
// showed the same headlines all week. Asking it for today's date, which
// this file already did, changed nothing — the date picks which digest,
// and the digest barely moves.
//
// It now reads real wires (BBC World, the Guardian, Al Jazeera, NPR)
// server-side, cut to the last 24 hours. None of them send CORS headers,
// which is precisely why the feed service reads them instead of the
// browser.

export interface WorldNewsStory {
    id: string;
    /** The headline. */
    text: string;
    /** Which wire it came from. */
    title: string;
    url: string;
    /** How long ago it ran, as a phrase ("2h ago"). */
    description: string;
    /** Opening of the article itself — what the story is about, in full
     *  sentences, so a reader can decide before leaving the app. */
    excerpt: string;
    /** The same extract untrimmed, for the story's own page. */
    summary: string;
    /** Lead image, where the article has one. */
    image: string | null;
}

interface RawWorldStory {
    id: string;
    title: string;
    url: string;
    summary: string;
    image: string | null;
    source: string;
    publishedAt: string | null;
}

/** "just now", "2h ago", "yesterday" — enough to judge how fresh it is. */
function howLongAgo(iso: string | null): string {
    if (!iso) return "";
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!Number.isFinite(minutes) || minutes < 0) return "";
    if (minutes < 2) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
}

// Enough of the story to know what it is, cut on a sentence rather than
// mid-word — a summary that stops in the middle of a clause reads as
// broken data rather than as an excerpt.
function firstSentences(text: string, maxLength = 230): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength) return clean;

    const cut = clean.slice(0, maxLength);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    if (lastStop > maxLength * 0.5) return cut.slice(0, lastStop + 1);
    return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export async function fetchWorldNews(limit = 6): Promise<WorldNewsStory[]> {
    const res = await fetch("/api/world");
    if (!res.ok) throw new Error(`World news request failed: ${res.status}`);

    const data = await res.json() as { stories?: RawWorldStory[] };

    return (data.stories ?? []).slice(0, limit).map((story) => ({
        id: story.id,
        text: story.title,
        title: story.source,
        url: story.url,
        description: howLongAgo(story.publishedAt),
        excerpt: firstSentences(story.summary),
        summary: story.summary,
        image: story.image,
    }));
}
