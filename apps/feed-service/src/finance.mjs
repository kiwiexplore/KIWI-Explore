import { attr, blocks, tag } from "./rss.mjs";

/**
 * The money desks a browser may not read.
 *
 * KIWI's dashboard reads MarketWatch and iDNES Ekonomika for itself —
 * both send `Access-Control-Allow-Origin: *` (see
 * apps/command-center/src/lib/financeNews.ts). These three don't, and
 * that's the only reason they're here:
 *
 *   - CoinDesk and Cointelegraph, for crypto — the half of the Finance
 *     module its charts are actually about.
 *   - The Federal Reserve's own press releases. Rates and policy from
 *     the source rather than from somebody's report of it, and the one
 *     feed in KIWI that is primary rather than journalism.
 *
 * CoinDesk refuses a request with no User-Agent, which is why every
 * fetch here sends one that says what it is.
 */

const SOURCES = [
    { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", name: "CoinDesk" },
    { url: "https://cointelegraph.com/rss", name: "Cointelegraph" },
    { url: "https://www.federalreserve.gov/feeds/press_all.xml", name: "Federal Reserve" },
];

const USER_AGENT = "KIWI-EXPLORE/0.1 (personal dashboard; +https://github.com/)";

// Enough from each desk to be represented without one flooding the mix.
const PER_SOURCE = 8;

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

async function fetchFeed({ url, name }) {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${name} responded ${res.status}`);
    const xml = await res.text();

    return blocks(xml).slice(0, PER_SOURCE).map((item, index) => ({
        id: tag(item, "guid") || `${name}-${index}`,
        title: tag(item, "title"),
        url: cleanLink(tag(item, "link")),
        summary: tag(item, "description"),
        image: attr(item, "media:content", "url") ?? attr(item, "enclosure", "url"),
        source: name,
        category: tag(item, "category"),
        publishedAt: tag(item, "pubDate"),
    }));
}

/**
 * All three desks, newest first. One failing costs its own stories and
 * nothing else — the dashboard merges whatever comes back with the two
 * it reads itself.
 */
export async function financeStories() {
    const settle = (promise) => promise.catch(() => []);
    const batches = await Promise.all(SOURCES.map((source) => settle(fetchFeed(source))));

    return batches.flat()
        .filter((story) => story.title && story.url)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}
