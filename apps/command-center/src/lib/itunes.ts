// Live top-charts via Apple's iTunes RSS feed generator
// (itunes.apple.com/{country}/rss/...) — free, public, no key
// required, CORS-enabled for direct browser fetches. Real US top
// charts, not a search result standing in for "top" — catalog/chart
// data only, not the user's own library or personal recommendations.

export interface ChartEntry {
    id: string;
    name: string;
    artist: string;
    artworkUrl: string;
    link: string;
}

interface ITunesRSSLink {
    attributes: { href: string };
}

interface ITunesRSSEntry {
    id: { attributes: { "im:id": string } };
    "im:name": { label: string };
    "im:artist": { label: string };
    "im:image": Array<{ label: string }>;
    // Song entries carry two <link> tags (album + track), so this
    // comes back as an array; podcast entries carry one, so this comes
    // back as a single object — normalize both below.
    link: ITunesRSSLink | ITunesRSSLink[];
}

async function fetchChart(kind: "topsongs" | "toppodcasts", limit: number): Promise<ChartEntry[]> {
    const res = await fetch(`https://itunes.apple.com/us/rss/${kind}/limit=${limit}/json`);
    if (!res.ok) throw new Error(`iTunes RSS request failed: ${res.status}`);
    const data = await res.json();
    const entries: ITunesRSSEntry[] = data.feed?.entry ?? [];

    return entries.map((e) => {
        const link = Array.isArray(e.link) ? e.link[0] : e.link;
        return {
            id: e.id.attributes["im:id"],
            name: e["im:name"].label,
            artist: e["im:artist"].label,
            artworkUrl: e["im:image"]?.[e["im:image"].length - 1]?.label ?? "",
            link: link.attributes.href,
        };
    });
}

export function fetchTopSongs(limit = 6): Promise<ChartEntry[]> {
    return fetchChart("topsongs", limit);
}

export function fetchTopPodcasts(limit = 6): Promise<ChartEntry[]> {
    return fetchChart("toppodcasts", limit);
}
