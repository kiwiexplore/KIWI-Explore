/**
 * What a whole index, or all the gold there is, is worth.
 *
 * The board already prints a market capitalisation under every stock
 * and every coin, because Nasdaq and CoinGecko publish one per company
 * and per coin. Indices and commodities were left blank on the grounds
 * that they haven't got one — which is true of the FIGURE those APIs
 * serve, and false of the question. An index has a total: add up what
 * its constituents are worth. Gold has one: multiply every tonne ever
 * mined by today's price. Both numbers are published, for free, by
 * people who do the adding up.
 *
 * So this fetches them. Two pages, parsed for one number each, rather
 * than five hundred quotes summed here — the sum is the hard part and
 * somebody else has already done it, correctly, including the free
 * float and the multiple share classes that make a naive sum wrong.
 *
 * These are HTML pages, not APIs, which is the honest cost of it: a
 * redesign at either end breaks the parse. It breaks SOFTLY — the regex
 * misses, the value comes back absent, and the row goes back to
 * carrying no capitalisation, which is exactly where it was before.
 * Nothing else on the board depends on it.
 *
 * Cached for an hour rather than for the five minutes everything else
 * gets. A total capitalisation moves by fractions of a percent in a
 * day; re-downloading two thirds of a megabyte every five minutes to
 * watch it not change would be rude to the people serving it.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const TTL = 60 * 60 * 1000;

/**
 * Which index totals can actually be had, and from where.
 *
 * Only the American ones. stockanalysis.com publishes a "Total Market
 * Cap" on each of these list pages; the DAX, the FTSE, the Nikkei, the
 * CAC, the Euro Stoxx, the Hang Seng, the SMI, the ASX and the Russell
 * 2000 have no such page there and no free equivalent I could find, so
 * those rows keep their blank rather than borrowing a number from a
 * different index.
 *
 * ^IXIC is the Nasdaq COMPOSITE, and the page used for it is every
 * Nasdaq-listed stock — the closest published match, and the reason its
 * label says so rather than pretending to be the index exactly.
 */
const INDEX_PAGES = {
    "^GSPC": { slug: "sp-500-stocks", of: "S&P 500 companies" },
    "^DJI": { slug: "dow-jones-stocks", of: "the Dow 30" },
    "^IXIC": { slug: "nasdaq-stocks", of: "all Nasdaq-listed" },
};

/**
 * The metals, which are the only commodities with a capitalisation.
 *
 * A commodity's "market cap" means the value of the whole above-ground
 * stock, and that only makes sense for something that gets hoarded
 * rather than burnt or eaten. Gold, silver, platinum and palladium sit
 * in vaults and are counted. Oil, gas, copper, wheat, corn, coffee,
 * sugar, cocoa and cattle are consumed, and no reputable source
 * publishes a world total for them — so those rows stay blank, which is
 * the correct answer rather than a missing feature.
 */
const COMMODITY_ASSETS = {
    "GC=F": "Gold",
    "SI=F": "Silver",
    "PL=F": "Platinum",
    "PA=F": "Palladium",
};

const SCALE = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };

/** The character a tag is replaced by — see flatten(). */
const CELL = "\u0001";

let cache = { at: 0, caps: {} };

async function getText(url) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.text();
}

/**
 * Tags out, entities decoded, whitespace flattened.
 *
 * A tag becomes a marker rather than a space so that a cell boundary is
 * still visible afterwards: "Gold" as a whole cell has to be matchable
 * without also matching "Gold ETFs" or "Gold mining", which are real
 * rows on the same page and a hundredfold different number.
 */
function flatten(html) {
    return html
        .replace(/<[^>]+>/g, CELL)
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/[^\S\u0001]+/g, " ");
}

function parseFigure(digits, suffix) {
    const value = Number(digits.replace(/,/g, "")) * (SCALE[suffix] ?? 1);
    return Number.isFinite(value) && value > 0 ? value : null;
}

async function indexTotals() {
    const out = {};
    for (const [symbol, { slug }] of Object.entries(INDEX_PAGES)) {
        try {
            const text = flatten(await getText(`https://stockanalysis.com/list/${slug}/`));
            const match = text.match(/Total Market Cap[\s\u0001]*([\d.,]+) ?([TBMK])/);
            const value = match && parseFigure(match[1], match[2]);
            if (value) out[symbol] = value;
        } catch {
            // One page down leaves the others alone, and leaves this
            // row exactly as blank as it was yesterday.
        }
    }
    return out;
}

async function metalTotals() {
    const out = {};
    try {
        const text = flatten(await getText("https://companiesmarketcap.com/assets-by-market-cap/"));
        for (const [symbol, name] of Object.entries(COMMODITY_ASSETS)) {
            // Anchored on the markers either side of the name, so
            // "Gold" cannot match the "Gold ETFs & ETCs" row below it.
            const match = text.match(
                new RegExp(`${CELL} ?${name} ?${CELL}[\\s\\S]{0,300}?\\$([\\d.,]+) ?([TBMK])`),
            );
            const value = match && parseFigure(match[1], match[2]);
            if (value) out[symbol] = value;
        }
    } catch {
        // Same as above: no page, no caps, no change to anything else.
    }
    return out;
}

/**
 * Symbol to total capitalisation, for the symbols that have one.
 *
 * Absent from the map means there is no such number, which the board
 * renders as no line at all. Never zero, never a guess.
 */
export async function totalCapitals() {
    if (Date.now() - cache.at < TTL && Object.keys(cache.caps).length > 0) return cache.caps;

    const [indices, metals] = await Promise.all([indexTotals(), metalTotals()]);
    const caps = { ...indices, ...metals };

    // An empty result is NOT cached, so a blip at either end is retried
    // on the next refresh instead of leaving the board blank for an
    // hour.
    if (Object.keys(caps).length > 0) cache = { at: Date.now(), caps };
    return caps;
}

/**
 * What the number is a total OF.
 *
 * Without this the line is a category error. "S&P 500 · cap $69.9T"
 * reads as though the index were a company worth seventy trillion; it
 * is the five hundred companies IN it that are worth that, and the
 * three words saying so are the difference between a fact and a
 * misreading. Same for gold: the figure is every ounce ever mined at
 * today's price, not the price of an ounce.
 */
export function capitalOf(symbol) {
    if (INDEX_PAGES[symbol]) return INDEX_PAGES[symbol].of;
    if (COMMODITY_ASSETS[symbol]) return "all above ground";
    return null;
}
