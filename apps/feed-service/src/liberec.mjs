import { attr, blocks, decode, tag } from "./rss.mjs";

/**
 * The Liberec sources a BROWSER can't reach, fetched here instead.
 *
 * KIWI's dashboard already reads iDNES and Český rozhlas Liberec
 * directly — both send `Access-Control-Allow-Origin: *`, so a page may
 * read them (see apps/command-center/src/lib/liberecNews.ts). These two
 * don't, and that's the entire reason this service exists:
 *
 *   - Liberecký deník publishes a full RSS feed and answers without any
 *     CORS header, so the browser throws the response away unread.
 *   - Liberecká drbna publishes no ordinary feed at all. What it does
 *     publish — discoverable only from its robots.txt — is a Google
 *     News sitemap: every fresh article with a title, a link and a
 *     timestamp. That's the headline list; the perex and the picture
 *     come from each article's own Open Graph tags.
 *
 * CORS is a rule browsers follow, not one servers enforce, so none of
 * it applies here. Both sites' robots.txt allow reading article pages
 * (they disallow only search, login and the e-shop).
 *
 * Deliberately limited to a headline, a couple of sentences and a link
 * back to the source — the same thing any feed reader shows. Pulling
 * whole articles across would be republishing someone else's work.
 */

const DENIK_FEED = "https://liberecky.denik.cz/rss/vse.xml";
const DRBNA_SITEMAP = "https://liberecka.drbna.cz/feed/google.xml";

// How many Drbna articles get their page fetched for a perex and a
// photo. Each one is a request to someone else's server, so this stays
// small and the whole result is cached (see cache.mjs).
const DRBNA_ENRICHED = 8;

// Deník's regional feed is the "vše" feed: it mixes the Liberec desk's
// own stories in with national ones from the group. They're told apart
// by where the article actually lives — the region's own subdomain
// against denik.cz — which is a far steadier rule than reading the
// category.
const DENIK_REGIONAL_HOST = "liberecky.denik.cz";

const USER_AGENT = "KIWI-EXPLORE/0.1 (personal dashboard; +https://github.com/)";

// Every link in these feeds carries campaign tracking. It does nothing
// for a reader and follows them to the article, so it comes off.
function cleanLink(url) {
    try {
        const parsed = new URL(url);
        [...parsed.searchParams.keys()]
            .filter((key) => key.startsWith("utm_"))
            .forEach((key) => parsed.searchParams.delete(key));
        parsed.hash = parsed.hash.startsWith("#utm_") ? "" : parsed.hash;
        return parsed.toString();
    } catch {
        return url;
    }
}

function isRegional(url) {
    try {
        return new URL(url).hostname === DENIK_REGIONAL_HOST;
    } catch {
        return false;
    }
}

async function fetchText(url) {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return res.text();
}

function denikStories(xml) {
    return blocks(xml)
        .map((item, index) => ({
        id: tag(item, "guid") || `denik-${index}`,
        title: tag(item, "title"),
        url: cleanLink(tag(item, "link")),
        summary: tag(item, "description"),
        image: attr(item, "enclosure", "url") ?? attr(item, "media:content", "url"),
        source: "Liberecký deník",
        category: tag(item, "category"),
        publishedAt: tag(item, "pubDate"),
        }))
        .filter((story) => isRegional(story.url));
}

/**
 * The sitemap gives a headline, a link and a time — no text and no
 * picture. Those come from the article's own Open Graph tags, which is
 * the summary the site itself hands to anything sharing the link.
 */
async function drbnaDetail(story) {
    try {
        const html = await fetchText(story.url);
        const meta = (property) => {
            const match = html.match(
                new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`, "i"),
            ) ?? html.match(
                new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${property}"`, "i"),
            );
            return match ? decode(match[1]) : "";
        };
        return { ...story, summary: meta("og:description"), image: meta("og:image") || null };
    } catch {
        // A story without its perex is still a story worth listing.
        return story;
    }
}

async function drbnaStories(xml) {
    const listed = blocks(xml, "url").map((entry, index) => ({
        id: tag(entry, "loc") || `drbna-${index}`,
        title: tag(entry, "news:title"),
        url: cleanLink(tag(entry, "loc")),
        summary: "",
        image: null,
        source: "Liberecká drbna",
        category: "",
        publishedAt: tag(entry, "news:publication_date"),
    }));

    const newest = listed
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, DRBNA_ENRICHED);

    return Promise.all(newest.map(drbnaDetail));
}

/**
 * Everything this service can reach, newest first.
 *
 * One source failing must not empty the list — each is caught on its
 * own, so a site being down costs its own stories and nothing else.
 */
export async function liberecStories() {
    const settle = (promise) => promise.catch(() => []);

    const [denik, drbna] = await Promise.all([
        settle(fetchText(DENIK_FEED).then(denikStories)),
        settle(fetchText(DRBNA_SITEMAP).then(drbnaStories)),
    ]);

    return [...denik, ...drbna]
        .filter((story) => story.title && story.url)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}
