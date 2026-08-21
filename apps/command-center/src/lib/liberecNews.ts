// Live news from Liberec and the Liberecký kraj, from every regional
// source a browser can actually read.
//
// That last part is the whole story of this file. A page can only fetch
// from a server that says it may (CORS), and most Czech news sites
// don't: Liberecký deník's feed answers 200 with no
// Access-Control-Allow-Origin at all, so the browser throws the
// response away before this app sees a byte of it. Liberecká drbna and
// Genus publish no feed of any kind — no RSS, no Atom, nothing in the
// page head to discover. None of that is something a fetch can work
// around; it would take a server of KIWI's own to sit in the middle and
// re-serve those feeds.
//
// What IS readable from here, and what this reads directly:
//   - iDNES.cz's "Liberecký kraj" feed, which carries a real perex and
//     a lead photo per item
//   - Český rozhlas Liberec, the regional station — text only, and
//     often the local story iDNES doesn't run
//
// Both are RSS, parsed with the browser's own DOMParser rather than by
// pulling in an XML library.
//
// Liberecký deník and Liberecká drbna are read by KIWI's own feed
// service instead (apps/feed-service), which has no browser rules to
// obey — and this asks it for them. If that service isn't running, its
// two sources are simply missing and the other two still fill the
// module: nothing here waits on it.

export type LiberecStory = FeedStory;

import {
    dedupeByTitle, fetchRssFeed, newestFirst, settleFeeds, type FeedStory,
} from "./rssFeed";

const IDNES_FEED = "https://servis.idnes.cz/rss.aspx?c=liberec";
const CRO_FEED = "https://liberec.rozhlas.cz/rss.xml";
// Same origin while developing (the dev server mounts the service — see
// vite.config.ts); set VITE_FEED_SERVICE to point at it once it's
// deployed somewhere of its own.
const SERVICE_URL = `${import.meta.env.VITE_FEED_SERVICE ?? ""}/api/liberec`;
const BRIEF_URL = `${SERVICE_URL}/brief`;

/**
 * Football, out (per explicit request).
 *
 * Matched on words rather than on a category, because only one of the
 * two feeds files stories into categories at all. Club names are listed
 * for the ones whose football team is what "Liberec" and "Jablonec"
 * usually mean in a headline — the towns themselves are obviously not
 * filtered, and no other sport is.
 */
const FOOTBALL = /fotbal|fotbalist|fotbalov|slovan liberec|fk jablonec|konferenční lig|chance liga|ligov[ýáéo]|penalt|gólman|brankář|derby/i;

function isFootball(story: { title: string; summary: string; category: string }): boolean {
    return FOOTBALL.test(`${story.title} ${story.summary} ${story.category}`);
}

/** Whatever KIWI's own service can reach that this page can't. */
async function fetchFromService(): Promise<LiberecStory[]> {
    const res = await fetch(SERVICE_URL);
    if (!res.ok) throw new Error(`feed service responded ${res.status}`);
    const data = await res.json() as { stories?: LiberecStory[] };
    return data.stories ?? [];
}

export interface LiberecBrief {
    /** False when the service has no Anthropic API key set. */
    configured: boolean;
    /** The digest itself — a short paragraph, or "" when there is none. */
    brief: string;
    sources: string[];
    generatedAt: string | null;
}

/**
 * The day in a paragraph, written by Claude from every source at once —
 * including the two this page reads for itself, since a digest that saw
 * half the news would be a worse one.
 *
 * Only the service can do this: the key belongs on a server, and a key
 * shipped to a browser is a key given away. Without one it answers
 * `configured: false` and the module simply shows the list, which is
 * what it did before the digest existed.
 */
export async function fetchLiberecBrief(): Promise<LiberecBrief> {
    const res = await fetch(BRIEF_URL);
    if (!res.ok) throw new Error(`brief request failed: ${res.status}`);
    return await res.json() as LiberecBrief;
}

/**
 * Both feeds, football dropped, newest first.
 *
 * One source failing does NOT empty the list: each is caught on its
 * own, so a station being down still leaves the other's stories on the
 * page.
 */
export async function fetchLiberecNews(limit = 10): Promise<LiberecStory[]> {
    const [idnes, cro, service] = await Promise.all([
        settleFeeds(fetchRssFeed(IDNES_FEED, "iDNES.cz")),
        settleFeeds(fetchRssFeed(CRO_FEED, "ČRo Liberec")),
        settleFeeds(fetchFromService()),
    ]);

    return newestFirst(dedupeByTitle([...idnes, ...cro, ...service]
        .filter((story) => story.title && !isFootball(story))))
        .slice(0, limit);
}
