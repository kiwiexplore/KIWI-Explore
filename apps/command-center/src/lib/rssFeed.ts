/**
 * Reading an RSS feed in the browser.
 *
 * Shared by every source KIWI can fetch for itself — the Liberec ones
 * (lib/liberecNews.ts) and the financial ones (lib/financeNews.ts) —
 * because they differ only in which URLs they ask for. Parsed with the
 * browser's own DOMParser rather than by pulling in an XML library: a
 * feed item is four fields and the parser is already there.
 *
 * Whether a given feed can be read from a page at all is not up to this
 * file: a server that answers without an `Access-Control-Allow-Origin`
 * header has its response thrown away by the browser before any of this
 * runs. Those sources go through KIWI's feed service instead — see
 * apps/feed-service.
 */

export interface FeedStory {
    id: string;
    title: string;
    url: string;
    /** The feed's own perex — a real paragraph, not a truncated title. */
    summary: string;
    /** Lead photo, where the source publishes one. */
    image: string | null;
    /** Who ran it, so a merged list still says where each item is from. */
    source: string;
    /** The source's own section for the story, where it has one. */
    category: string;
    publishedAt: string;
}

/** Headlines carry hard line breaks where a front page would wrap. */
export function tidy(text: string | null | undefined): string {
    return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Campaign tracking off the end of a link. It does nothing for a reader
 * and follows them to the article.
 */
export function cleanLink(url: string): string {
    const hash = url.indexOf("#utm_source");
    const trimmed = hash === -1 ? url : url.slice(0, hash);
    try {
        const parsed = new URL(trimmed);
        [...parsed.searchParams.keys()]
            .filter((key) => key.startsWith("utm_") || key === "mod")
            .forEach((key) => parsed.searchParams.delete(key));
        return parsed.toString();
    } catch {
        return trimmed;
    }
}

export function parseRssFeed(xml: string, source: string): FeedStory[] {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    // A parse failure shows up as a <parsererror> node rather than as a
    // thrown error — an unchecked one would quietly render an empty list.
    if (doc.querySelector("parsererror")) throw new Error(`${source} feed could not be parsed`);

    return [...doc.querySelectorAll("item")].map((item, index) => {
        // media:content is namespaced, and querySelector can't match a
        // prefixed name — the local name is what's available here.
        const media = [...item.children].find((child) => child.localName === "content");
        const enclosure = item.querySelector("enclosure");

        return {
            id: tidy(item.querySelector("guid")?.textContent) || `${source}-${index}`,
            title: tidy(item.querySelector("title")?.textContent),
            url: cleanLink(tidy(item.querySelector("link")?.textContent)),
            summary: tidy(item.querySelector("description")?.textContent),
            image: media?.getAttribute("url") ?? enclosure?.getAttribute("url") ?? null,
            source,
            category: tidy(item.querySelector("category")?.textContent),
            publishedAt: tidy(item.querySelector("pubDate")?.textContent),
        };
    });
}

export async function fetchRssFeed(url: string, source: string): Promise<FeedStory[]> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${source} feed request failed: ${res.status}`);
    return parseRssFeed(await res.text(), source);
}

/** Runs every source, and lets the ones that fail simply be absent. */
export function settleFeeds<T>(promise: Promise<T[]>): Promise<T[]> {
    return promise.catch((): T[] => []);
}

/**
 * The same event covered twice should appear once. Compared on the
 * headline with punctuation and case thrown away, which is as far as
 * this can go without the feeds sharing any id.
 */
export function dedupeByTitle<T extends { title: string }>(stories: T[]): T[] {
    const seen = new Set<string>();
    return stories.filter((story) => {
        const key = story.title.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function newestFirst<T extends { publishedAt: string }>(stories: T[]): T[] {
    return [...stories].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/**
 * Takes one story from each desk in turn, newest first within each.
 *
 * Straight date order looks fair and isn't: a wire service that files
 * twenty times a day buries a central bank that files twice a week, and
 * the list ends up being one newsroom with guests. Reading several
 * desks is the whole reason for having several, so each one gets its
 * turn before any gets a second.
 */
export function interleaveBySource<T extends { source: string; publishedAt: string }>(stories: T[]): T[] {
    const desks = new Map<string, T[]>();
    newestFirst(stories).forEach((story) => {
        const desk = desks.get(story.source);
        if (desk) desk.push(story);
        else desks.set(story.source, [story]);
    });

    const queues = [...desks.values()];
    const mixed: T[] = [];
    for (let round = 0; mixed.length < stories.length; round++) {
        let placed = false;
        for (const queue of queues) {
            const story = queue[round];
            if (!story) continue;
            mixed.push(story);
            placed = true;
        }
        // Every queue is exhausted — nothing left to place.
        if (!placed) break;
    }
    return mixed;
}
