import { attr, blocks, tag } from "./rss.mjs";

/**
 * World news that actually moves.
 *
 * The dashboard read Wikipedia's "In the news" section, which is
 * keyless and CORS-friendly and looked like the perfect fit — but it is
 * an editorial digest, not a wire. Its five items are chosen by editors
 * and stay on the front page for days, so the module showed the same
 * headlines all week. Asking it for today's date, which the client
 * already did, changes nothing: the date picks which digest, and the
 * digest barely changes.
 *
 * These are real wires that publish continuously. None of them send
 * CORS headers, which is exactly why they belong here rather than in a
 * browser fetch — the same reason Liberec and the finance desks are.
 */

const SOURCES = [
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC World" },
    { url: "https://www.theguardian.com/world/rss", name: "The Guardian" },
    { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera" },
    { url: "https://feeds.npr.org/1004/rss.xml", name: "NPR World" },
];

const USER_AGENT = "KIWI-EXPLORE/0.1 (personal dashboard; +https://github.com/)";

// Enough from each wire to be represented without one of them flooding
// the mix once everything is merged and sorted by time.
const PER_SOURCE = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

function cleanLink(url) {
    try {
        const parsed = new URL(url);
        [...parsed.searchParams.keys()]
            .filter((key) => key.startsWith("utm_"))
            .forEach((key) => parsed.searchParams.delete(key));
        return parsed.toString();
    } catch {
        return url;
    }
}

// RSS descriptions routinely carry markup, and this is served to a
// dashboard that renders it as text.
function stripMarkup(html) {
    return String(html ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function fetchFeed({ url, name }) {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${name} responded ${res.status}`);
    const xml = await res.text();

    return blocks(xml).slice(0, PER_SOURCE).map((item, index) => {
        const published = tag(item, "pubDate") || tag(item, "dc:date");
        return {
            id: tag(item, "guid") || `${name}-${index}`,
            title: tag(item, "title"),
            url: cleanLink(tag(item, "link")),
            summary: stripMarkup(tag(item, "description")),
            image: attr(item, "media:thumbnail", "url")
                ?? attr(item, "media:content", "url")
                ?? attr(item, "enclosure", "url")
                ?? null,
            source: name,
            publishedAt: published ? new Date(published).toISOString() : null,
        };
    });
}

/**
 * Every wire merged, newest first, and cut to the last 24 hours so the
 * module is genuinely today's news rather than whatever happens to sit
 * at the top of a feed.
 *
 * If that window comes back thin — a quiet night, or several wires
 * failing at once — the newest stories are returned regardless rather
 * than an empty list. An empty news module reads as broken; a slightly
 * older headline reads as a slow day, which is the truth.
 *
 * One wire failing costs its own stories and nothing else.
 */
export async function worldStories() {
    const settle = (promise) => promise.catch(() => []);
    const batches = await Promise.all(SOURCES.map((source) => settle(fetchFeed(source))));

    const all = batches.flat()
        .filter((story) => story.title && story.url)
        .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));

    // Deduplicate: the same event often runs on several wires within
    // minutes, and three near-identical headlines waste the module.
    const seen = new Set();
    const unique = all.filter((story) => {
        const key = story.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const cutoff = Date.now() - DAY_MS;
    const today = unique.filter((story) => story.publishedAt && new Date(story.publishedAt).getTime() >= cutoff);

    return today.length >= 6 ? today : unique.slice(0, 12);
}
