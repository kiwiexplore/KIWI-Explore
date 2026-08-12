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
}

export async function fetchTopStories(limit = 5): Promise<HackerNewsStory[]> {
    const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!idsRes.ok) throw new Error(`Hacker News API request failed: ${idsRes.status}`);
    const ids: number[] = await idsRes.json();

    const items = await Promise.all(
        ids.slice(0, limit).map((id) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json())
        )
    );

    return items.map((item) => ({
        id: item.id,
        title: item.title,
        // Self-posts (Ask HN, Show HN discussions) have no `url` —
        // link to the HN discussion thread itself in that case.
        url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
        score: item.score ?? 0,
        by: item.by ?? "",
    }));
}
