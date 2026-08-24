/**
 * Stock indices and commodities — the one part of "markets" the Finance
 * module could never show.
 *
 * Every equity feed worth having wants an API key — that's why the
 * module said so plainly instead of faking it. Yahoo's chart endpoint
 * is the exception: no key, real data, and a month of closes with it.
 * What it doesn't send is a CORS header, so a page can't read it and
 * this does.
 *
 * A month of daily closes rather than a single number, because the
 * whole point of the panel these feed is that a figure alone says
 * nothing about how it got there.
 */

import { capitalOf, totalCapitals } from "./capitals.mjs";

const INSTRUMENTS = [
    { symbol: "^GSPC", name: "S&P 500", group: "index" },
    { symbol: "^DJI", name: "Dow Jones", group: "index" },
    { symbol: "^IXIC", name: "Nasdaq", group: "index" },
    { symbol: "^GDAXI", name: "DAX", group: "index" },
    { symbol: "^FTSE", name: "FTSE 100", group: "index" },
    { symbol: "^N225", name: "Nikkei 225", group: "index" },
    { symbol: "^STOXX50E", name: "Euro Stoxx 50", group: "index" },
    { symbol: "^FCHI", name: "CAC 40", group: "index" },
    { symbol: "^HSI", name: "Hang Seng", group: "index" },
    { symbol: "^RUT", name: "Russell 2000", group: "index" },
    { symbol: "^SSMI", name: "SMI", group: "index" },
    { symbol: "^AXJO", name: "ASX 200", group: "index" },
    { symbol: "^BSESN", name: "Sensex", group: "index" },
    { symbol: "^KS11", name: "KOSPI", group: "index" },
    // Prague's ^PX answers, but with a price of zero and no series —
    // a dead row rather than a missing one, so it's left out.
    { symbol: "^VIX", name: "VIX", group: "index" },
    // The same endpoint serves futures, so commodities cost nothing
    // extra — and they're the half of "markets" that moves for
    // different reasons than equities do.
    { symbol: "GC=F", name: "Gold", group: "commodity" },
    { symbol: "SI=F", name: "Silver", group: "commodity" },
    { symbol: "CL=F", name: "WTI crude", group: "commodity" },
    { symbol: "BZ=F", name: "Brent crude", group: "commodity" },
    { symbol: "NG=F", name: "Natural gas", group: "commodity" },
    { symbol: "HG=F", name: "Copper", group: "commodity" },
    { symbol: "PL=F", name: "Platinum", group: "commodity" },
    { symbol: "ZW=F", name: "Wheat", group: "commodity" },
    { symbol: "ZC=F", name: "Corn", group: "commodity" },
    { symbol: "KC=F", name: "Coffee", group: "commodity" },
    { symbol: "PA=F", name: "Palladium", group: "commodity" },
    { symbol: "ZS=F", name: "Soybeans", group: "commodity" },
    { symbol: "SB=F", name: "Sugar", group: "commodity" },
    { symbol: "CC=F", name: "Cocoa", group: "commodity" },
    { symbol: "LE=F", name: "Live cattle", group: "commodity" },
];

// Yahoo refuses requests it reads as scripted.
/**
 * Market capitalisation, from Nasdaq's own public API.
 *
 * Yahoo is where everything else on this board comes from and it will
 * not give one up: its chart endpoint carries no such field, and both
 * endpoints that do (v7/quote, v10/quoteSummary) answer 401 without a
 * session — and the crumb flow that would get that session is itself
 * rate-limited. Nasdaq publishes the number for free, keyless, with
 * nothing more than a browser user-agent, so that is where this asks.
 *
 * One request per symbol, which is why it only runs for STOCKS: an
 * index is an average rather than a company and a barrel of oil is
 * neither, so there is no number to fetch for those and no request
 * made. The whole result is cached for five minutes with everything
 * else (see handler.mjs).
 *
 * A symbol Nasdaq doesn't know, or one with no cap to publish — a
 * closed-end fund, a mutual fund — comes back null and the row simply
 * carries no cap. Guessing one would be worse than the gap.
 */
const NASDAQ_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** Yahoo writes Berkshire's B shares BRK-B; Nasdaq writes BRK.B. */
function nasdaqSymbol(symbol) {
    return symbol.replace("-", ".");
}

async function fetchMarketCap(symbol) {
    try {
        const res = await fetch(
            `https://api.nasdaq.com/api/quote/${encodeURIComponent(nasdaqSymbol(symbol))}/summary?assetclass=stocks`,
            { headers: { "User-Agent": NASDAQ_UA, Accept: "application/json" } },
        );
        if (!res.ok) return null;
        const raw = (await res.json())?.data?.summaryData?.MarketCap?.value;
        if (typeof raw !== "string") return null;
        // Arrives as "4,514,709,583,000", and as "N/A" for anything
        // that hasn't got one.
        const value = Number(raw.replace(/[^0-9.]/g, ""));
        return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
        return null;
    }
}

// The twenty-odd largest listed companies. The order here is a
// starting point only — the board sorts by the capitalisation it
// actually fetches, so the ranking is live rather than a list that
// drifts as companies do.
const STOCKS = [
    { symbol: "NVDA", name: "Nvidia" },
    { symbol: "AAPL", name: "Apple" },
    { symbol: "MSFT", name: "Microsoft" },
    { symbol: "GOOGL", name: "Alphabet" },
    { symbol: "AMZN", name: "Amazon" },
    { symbol: "META", name: "Meta" },
    { symbol: "AVGO", name: "Broadcom" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "BRK-B", name: "Berkshire" },
    { symbol: "TSM", name: "TSMC" },
    { symbol: "LLY", name: "Eli Lilly" },
    { symbol: "JPM", name: "JPMorgan" },
    { symbol: "V", name: "Visa" },
    { symbol: "WMT", name: "Walmart" },
    { symbol: "XOM", name: "Exxon" },
    { symbol: "UNH", name: "UnitedHealth" },
    { symbol: "MA", name: "Mastercard" },
    { symbol: "ORCL", name: "Oracle" },
    { symbol: "COST", name: "Costco" },
    { symbol: "JNJ", name: "Johnson & Johnson" },
    { symbol: "HD", name: "Home Depot" },
    { symbol: "PG", name: "Procter & Gamble" },
    { symbol: "NFLX", name: "Netflix" },
    { symbol: "AMD", name: "AMD" },
    // SpaceX itself cannot be here: it is privately held and has no
    // ticker on any exchange, so there is nothing to quote. These two
    // are what a listed portfolio actually reaches it through, and they
    // are named for what they ARE rather than for what they hold —
    // calling either of them "SpaceX" would be inventing a listing.
    //
    // Destiny Tech100 is a closed-end fund whose largest position is
    // SpaceX; it trades at a wide and unstable premium to the value of
    // what it owns, so it tracks sentiment about SpaceX far more
    // closely than it tracks SpaceX. ARK Venture holds a stake too and
    // is priced from its own valuation of it rather than from a market.
    { symbol: "DXYZ", name: "Destiny Tech100" },
    { symbol: "ARKVX", name: "ARK Venture" },
].map((stock, order) => ({ ...stock, group: "stock", order }));

/**
 * The spans the dashboard can ask for, and what Yahoo needs to be told
 * to return each one. The interval matters as much as the range: a year
 * at daily resolution is 250 points down a 40-pixel line, which draws
 * as noise.
 */
const RANGES = {
    "1d": { range: "1d", interval: "15m" },
    "1w": { range: "5d", interval: "15m" },
    "1mo": { range: "1mo", interval: "1d" },
    "1y": { range: "1y", interval: "1wk" },
    max: { range: "max", interval: "1mo" },
};

export const RANGE_KEYS = Object.keys(RANGES);

const USER_AGENT = "Mozilla/5.0 (compatible; KIWI-EXPLORE/0.1)";

// How many quotes are asked for at a time. See indexQuotes.
const BATCH_SIZE = 14;

async function fetchIndex({ symbol, name, group, order }, span) {
    const { range, interval } = RANGES[span] ?? RANGES["1mo"];
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
        + `?range=${range}&interval=${interval}`;
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${name} responded ${res.status}`);

    const result = (await res.json())?.chart?.result?.[0];
    if (!result) throw new Error(`${name} returned no series`);

    const meta = result.meta ?? {};
    const price = meta.regularMarketPrice;
    const previous = meta.chartPreviousClose ?? meta.previousClose;
    // Gaps in the series are holidays and halts, not zeroes — dropping
    // them keeps a flat line from having a hole punched through it.
    const month = (result.indicators?.quote?.[0]?.close ?? []).filter((value) => value !== null);

    return {
        symbol,
        group,
        // Only stocks carry one; it's what the heatmap orders by.
        order,
        // Our own name first: Yahoo's shortName arrives padded and
        // occasionally suffixed ("DAX                    P").
        name,
        price,
        currency: meta.currency ?? "",
        // How much changed hands today. Nothing on the board reads it
        // any more — it is kept because it costs nothing, arrives in
        // the same response, and is the obvious next thing to want.
        volume: meta.regularMarketVolume ?? null,
        // Filled in afterwards, from somewhere that isn't Yahoo:
        // Nasdaq for a company, stockanalysis or companiesmarketcap
        // for an index or a metal. Null for the rows that genuinely
        // have no such number — a barrel of oil, a bushel of wheat.
        marketCap: null,
        /** What the cap is a total OF, where that needs saying. */
        capOf: null,
        // The year's range, which is the other thing a single price
        // tells you nothing about.
        yearLow: meta.fiftyTwoWeekLow ?? null,
        yearHigh: meta.fiftyTwoWeekHigh ?? null,
        change: price - previous,
        changePercent: previous ? ((price - previous) / previous) * 100 : 0,
        // Named for what it is now that the span is a choice: the
        // series for whatever period was asked for.
        month,
        span,
    };
}

/**
 * Indices, commodities and the large-cap stocks, over one span.
 *
 * One request per instrument, run together — Yahoo has no batch
 * endpoint left that answers without a session. Roughly forty calls,
 * which is why the result is cached (see handler.mjs) rather than
 * fetched per render.
 */
export async function indexQuotes(span = "1mo") {
    const settle = (promise) => promise.catch(() => null);
    const all = [...INSTRUMENTS, ...STOCKS];

    // In batches rather than all at once. Firing forty requests at
    // Yahoo together gets a handful of them refused — the boards came
    // back two short every time, and which two moved around, which is
    // what a rate limit looks like rather than a bad symbol.
    const quotes = [];
    for (let i = 0; i < all.length; i += BATCH_SIZE) {
        const batch = all.slice(i, i + BATCH_SIZE);
        quotes.push(...await Promise.all(batch.map((instrument) => settle(fetchIndex(instrument, span)))));
    }

    const found = quotes.filter((quote) => quote && Number.isFinite(quote.price));

    // Capitalisations, for the stocks only and in the same batches for
    // the same reason. Nasdaq is a different host from Yahoo, so this
    // runs after rather than alongside — a rate limit on one shouldn't
    // be provoked while the other is still going.
    const stocks = found.filter((quote) => quote.group === "stock");
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
        const batch = stocks.slice(i, i + BATCH_SIZE);
        const caps = await Promise.all(batch.map((quote) => settle(fetchMarketCap(quote.symbol))));
        batch.forEach((quote, n) => { quote.marketCap = caps[n] ?? null; });
    }

    // Ranked by what was actually fetched rather than by the order they
    // were listed in. `order` is what the heatmap sizes by, and it can
    // finally mean the real thing — anything with no cap to rank by
    // keeps its listed place at the back rather than jumping to the
    // front on a zero.
    const ranked = stocks.filter((q) => q.marketCap).sort((a, b) => b.marketCap - a.marketCap);
    ranked.forEach((quote, n) => { quote.order = n; });
    stocks.filter((q) => !q.marketCap).forEach((quote, n) => { quote.order = ranked.length + n; });

    // And the totals for the rows that aren't companies. An index and a
    // metal both HAVE a capitalisation — the sum of the constituents,
    // the worth of every ounce ever dug up — it just isn't a number any
    // quote API carries, because it isn't a property of the instrument
    // being quoted. See capitals.mjs for where each one comes from.
    //
    // Two page fetches, cached for an hour, and a failure at either end
    // leaves the affected rows exactly as they were before this
    // existed: no cap, no line.
    const totals = await settle(totalCapitals()) ?? {};
    for (const quote of found) {
        if (quote.group === "stock") continue;
        quote.marketCap = totals[quote.symbol] ?? null;
        quote.capOf = quote.marketCap ? capitalOf(quote.symbol) : null;
    }

    return found;
}
