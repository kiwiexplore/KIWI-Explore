// Live world news via Wikipedia's "In the news" feed, through the
// Wikimedia REST API — free, public, no API key, and CORS-enabled for
// direct browser fetches.
//
// This was not the first choice. GDELT's document API looked ideal on
// paper (keyless, worldwide, many languages) but does NOT send CORS
// headers, so a browser can't read it; every conventional news API
// (NewsAPI, GNews, Guardian, Bing) needs a secret a frontend can't hold.
// Wikipedia's own front-page news section is the rare thing that's
// keyless, browser-readable, and genuinely global — and it's editorially
// filtered to events that actually matter rather than to whatever a
// publisher pushed hardest today.

export interface WorldNewsStory {
    id: string;
    /** Plain-text summary of the event. */
    text: string;
    /** The article the story links to. */
    title: string;
    url: string;
    /** One-line note on what that article is ("Earthquake in Indonesia"). */
    description: string;
    /** Opening of the article itself — what the story is about, in full
     *  sentences, so a reader can decide before leaving the app. */
    excerpt: string;
    /** The same extract untrimmed, for the story's own page. */
    summary: string;
    /** Lead image, where the article has one. */
    image: string | null;
}

interface WikimediaLink {
    titles?: { normalized?: string };
    title?: string;
    description?: string;
    extract?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
}

interface WikimediaNewsItem {
    story: string;
    links?: WikimediaLink[];
}

// The feed's story text is a fragment of HTML — links and italics.
function stripMarkup(html: string): string {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

// Enough of the article to know what it is, cut on a sentence rather
// than mid-word — a summary that stops in the middle of a clause reads
// as broken data rather than as an excerpt.
function firstSentences(text: string, maxLength = 230): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength) return clean;

    const cut = clean.slice(0, maxLength);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    if (lastStop > maxLength * 0.5) return cut.slice(0, lastStop + 1);
    return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export async function fetchWorldNews(limit = 6): Promise<WorldNewsStory[]> {
    const today = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const path = `${today.getFullYear()}/${pad(today.getMonth() + 1)}/${pad(today.getDate())}`;

    const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${path}`);
    if (!res.ok) throw new Error(`Wikimedia feed request failed: ${res.status}`);

    const data = await res.json() as { news?: WikimediaNewsItem[] };

    return (data.news ?? []).slice(0, limit).map((item, index) => {
        // The first link is the event's own article — what the story is
        // "about" — with the rest being context (countries, people).
        const primary = item.links?.[0];
        const title = primary?.titles?.normalized ?? primary?.title ?? "Wikipedia";
        return {
            id: `${path}-${index}`,
            text: stripMarkup(item.story),
            title,
            url: primary?.content_urls?.desktop?.page
                ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
            description: primary?.description ?? "",
            excerpt: firstSentences(primary?.extract ?? ""),
            summary: (primary?.extract ?? "").trim(),
            image: primary?.thumbnail?.source ?? null,
        };
    });
}
