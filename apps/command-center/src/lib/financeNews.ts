import {
    dedupeByTitle, fetchRssFeed, interleaveBySource, settleFeeds, type FeedStory,
} from "./rssFeed";

/**
 * Money news, from as many desks as can be reached.
 *
 * The Finance module had charts and nothing to read: a price and a
 * seven-day line say WHAT moved and never why. These are the why.
 *
 * Five desks, deliberately not one — they disagree about what matters,
 * and that spread is the point:
 *
 *   - MarketWatch — global markets and companies
 *   - iDNES Ekonomika — the Czech economy, which no wire service covers
 *   - CoinDesk and Cointelegraph — crypto, the half of this module the
 *     charts are actually about
 *   - The Federal Reserve's own press releases — rates and policy from
 *     the source rather than from a report of it
 *
 * The first two send `Access-Control-Allow-Origin: *`, so a page may
 * read them and this does. The other three don't, so KIWI's feed
 * service reads them instead (apps/feed-service/src/finance.mjs) and
 * this asks it. With the service down, the two direct desks still fill
 * the section — nothing here waits on it.
 */

export type FinanceStory = FeedStory;

const MARKETWATCH_FEED = "https://feeds.content.dowjones.io/public/rss/mw_topstories";
const IDNES_ECONOMY_FEED = "https://servis.idnes.cz/rss.aspx?c=ekonomika";
const SERVICE_URL = `${import.meta.env.VITE_FEED_SERVICE ?? ""}/api/finance`;

async function fetchFromService(): Promise<FinanceStory[]> {
    const res = await fetch(SERVICE_URL);
    if (!res.ok) throw new Error(`feed service responded ${res.status}`);
    const data = await res.json() as { stories?: FinanceStory[] };
    return data.stories ?? [];
}

export async function fetchFinanceNews(limit = 12): Promise<FinanceStory[]> {
    const [markets, czech, service] = await Promise.all([
        settleFeeds(fetchRssFeed(MARKETWATCH_FEED, "MarketWatch")),
        settleFeeds(fetchRssFeed(IDNES_ECONOMY_FEED, "iDNES Ekonomika")),
        settleFeeds(fetchFromService()),
    ]);

    // Interleaved rather than sorted by time: MarketWatch alone files
    // often enough to fill this list on its own, and a section headed
    // "five desks" that shows one of them is a lie by arithmetic.
    return interleaveBySource(dedupeByTitle([...markets, ...czech, ...service]
        .filter((story) => story.title && story.url)))
        .slice(0, limit);
}
