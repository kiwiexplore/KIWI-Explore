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

export interface LiberecStory {
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

const IDNES_FEED = "https://servis.idnes.cz/rss.aspx?c=liberec";
const CRO_FEED = "https://liberec.rozhlas.cz/rss.xml";
// Same origin while developing (the dev server mounts the service — see
// vite.config.ts); set VITE_FEED_SERVICE to point at it once it's
// deployed somewhere of its own.
const SERVICE_URL = `${import.meta.env.VITE_FEED_SERVICE ?? ""}/api/liberec`;

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

// Headlines in these feeds carry hard line breaks where the front page
// would break the line — that's layout, not text.
function tidy(text: string | null | undefined): string {
    return (text ?? "").replace(/\s+/g, " ").trim();
}

// iDNES links end in a tracking fragment. It does nothing for a reader
// and follows them to the article, so it comes off.
function cleanLink(url: string): string {
    const hash = url.indexOf("#utm_source");
    return hash === -1 ? url : url.slice(0, hash);
}

function parseFeed(xml: string, source: string): LiberecStory[] {
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

async function fetchFeed(url: string, source: string): Promise<LiberecStory[]> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${source} feed request failed: ${res.status}`);
    return parseFeed(await res.text(), source);
}

/** Whatever KIWI's own service can reach that this page can't. */
async function fetchFromService(): Promise<LiberecStory[]> {
    const res = await fetch(SERVICE_URL);
    if (!res.ok) throw new Error(`feed service responded ${res.status}`);
    const data = await res.json() as { stories?: LiberecStory[] };
    return data.stories ?? [];
}

// The same event covered by both sources should appear once. Compared
// on the headline with punctuation and case thrown away, which is as
// far as this can go without the feeds sharing any id.
function titleKey(title: string): string {
    return title.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}

/**
 * Both feeds, football dropped, newest first.
 *
 * One source failing does NOT empty the list: each is caught on its
 * own, so a station being down still leaves the other's stories on the
 * page.
 */
export async function fetchLiberecNews(limit = 10): Promise<LiberecStory[]> {
    const settle = (promise: Promise<LiberecStory[]>) => promise.catch((): LiberecStory[] => []);
    const [idnes, cro, service] = await Promise.all([
        settle(fetchFeed(IDNES_FEED, "iDNES.cz")),
        settle(fetchFeed(CRO_FEED, "ČRo Liberec")),
        settle(fetchFromService()),
    ]);

    const seen = new Set<string>();
    return [...idnes, ...cro, ...service]
        .filter((story) => story.title && !isFootball(story))
        .filter((story) => {
            const key = titleKey(story.title);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, limit);
}
