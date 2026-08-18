// Live tech news via the Hacker News Firebase API
// (https://github.com/HackerNews/API) — free, public, no key required,
// CORS-enabled for direct browser fetches. Tech-focused only (there's
// no good keyless general-news API with CORS support), labeled as
// such in the widget rather than pretending to be general news.

export interface HackerNewsStory {
    id: number;
    title: string;
    url: string;
    score: number;
    by: string;
    /** How many comments the thread has drawn. */
    comments: number;
    /** Where the link goes ("arstechnica.com"), or "" for a self-post. */
    domain: string;
    /**
     * The post's own text, for Ask/Show HN and other self-posts.
     *
     * Link posts have NO summary anywhere in the API — the feed is a
     * title and a URL, and the only way to a description would be
     * fetching the linked page, which a browser can't do across origins
     * (and shouldn't, on someone else's bandwidth, for five links at a
     * time). Those show what the API does give: where it goes, how many
     * points, how busy the thread is.
     */
    excerpt: string;
}

export async function fetchTopStories(limit = 5): Promise<HackerNewsStory[]> {
    const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!idsRes.ok) throw new Error(`Hacker News API request failed: ${idsRes.status}`);
    const ids: number[] = await idsRes.json();

    // HN item text is HTML — paragraphs and links.
    const strip = (html: string) => {
        const el = document.createElement("div");
        el.innerHTML = html.replace(/<p>/g, " ");
        return (el.textContent ?? "").replace(/\s+/g, " ").trim();
    };

    const items = await Promise.all(
        ids.slice(0, limit).map((id) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json())
        )
    );

    return items.map((item) => {
        // Self-posts (Ask HN, Show HN discussions) have no `url` —
        // link to the HN discussion thread itself in that case.
        const url: string = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
        // A malformed url would otherwise take the whole batch down.
        const readDomain = () => {
            if (!item.url) return "";
            try {
                return new URL(item.url).hostname.replace(/^www\./, "");
            } catch {
                return "";
            }
        };

        return {
            id: item.id,
            title: item.title,
            url,
            score: item.score ?? 0,
            by: item.by ?? "",
            comments: item.descendants ?? 0,
            domain: readDomain(),
            excerpt: item.text ? strip(item.text) : "",
        };
    });
}
