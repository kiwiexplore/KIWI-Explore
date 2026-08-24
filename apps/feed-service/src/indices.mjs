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
// The twenty-odd largest listed companies, in order of market
// capitalisation. The order is CURATED, not live: Yahoo's quote
// endpoint — the one that returns a capitalisation — now answers
// "Unauthorized" without a session, and the chart endpoint this file
// uses doesn't carry one. So the ranking is a considered list rather
// than a computed one, and it drifts as companies do.
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
        // How much changed hands today.
        //
        // NOT a market cap, and it is here because a market cap can't
        // be had: this endpoint's `meta` has no such field, and both of
        // Yahoo's that do (v7/quote and v10/quoteSummary) answer 401
        // without a session. Volume is the size number this feed
        // genuinely carries, so it is the one shown — under its own
        // name, not under a borrowed one.
        volume: meta.regularMarketVolume ?? null,
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

    return quotes.filter((quote) => quote && Number.isFinite(quote.price));
}
