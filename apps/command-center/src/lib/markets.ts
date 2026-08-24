// Live crypto and currency rates, both from free, keyless, CORS-enabled
// APIs — same rule as weather and space news, so this needs no backend
// and no registration:
//   - CoinGecko for coin prices and 24h moves
//     (https://www.coingecko.com/en/api)
//   - Frankfurter for reference exchange rates, published by the ECB
//     (https://frankfurter.dev — the older frankfurter.app host stopped
//     answering, so this uses the current v1 endpoint)
//
// Deliberately NOT stocks: every equity feed worth using needs an API
// key, so that's a separate job with a signup attached (see the module
// roadmap) rather than something that can just be switched on here.

export interface Coin {
    id: string;
    symbol: string;
    name: string;
    price: number;
    /** Percent change over the last 24 hours. */
    change24h: number;
    marketCap: number;
    /**
     * Hourly prices over the last week — 168 points, oldest first. Read
     * as the shape of the week rather than as numbers: a coin that's
     * flat over 24h can still have had a week worth seeing, which is
     * exactly what a percentage alone hides.
     */
    week: number[];
}

export async function fetchCoins(limit = 6): Promise<Coin[]> {
    const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets"
        + `?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true`,
    );
    if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status}`);

    const data = await res.json() as Array<{
        id: string; symbol: string; name: string;
        current_price: number; price_change_percentage_24h: number | null; market_cap: number;
        sparkline_in_7d?: { price?: number[] };
    }>;

    return data.map((coin) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h ?? 0,
        marketCap: coin.market_cap,
        week: coin.sparkline_in_7d?.price ?? [],
    }));
}

export interface ExchangeRates {
    base: string;
    date: string;
    rates: { code: string; rate: number }[];
}

export interface RatePair { base: string; quote: string }
export interface PairRate extends RatePair { rate: number | null }
export interface PairRates {
    date: string;
    pairs: PairRate[];
}

/**
 * Four arbitrary pairs, both sides chosen.
 *
 * Frankfurter answers one base at a time with as many symbols as you
 * like, so the pairs are grouped by base and that is how many requests
 * this makes — one for four USD pairs, two for a mix. Asking per pair
 * would be four requests for something that is usually one.
 *
 * A pair whose base equals its quote is 1 without asking anybody, and a
 * base the service doesn't know comes back with a null rate rather than
 * taking the other three down with it.
 */
export async function fetchPairs(pairs: RatePair[]): Promise<PairRates> {
    const byBase = new Map<string, Set<string>>();
    for (const { base, quote } of pairs) {
        if (base === quote) continue;
        const set = byBase.get(base) ?? new Set<string>();
        set.add(quote);
        byBase.set(base, set);
    }

    let date = "";
    const found = new Map<string, number>();

    await Promise.all([...byBase.entries()].map(async ([base, quotes]) => {
        try {
            const res = await fetch(
                `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${[...quotes].join(",")}`,
            );
            if (!res.ok) return;
            const data = await res.json() as { date: string; rates: Record<string, number> };
            date = data.date || date;
            for (const [code, rate] of Object.entries(data.rates)) found.set(`${base}/${code}`, rate);
        } catch {
            // One base failing leaves the others alone; the pairs it
            // was for read as "—" rather than the column disappearing.
        }
    }));

    return {
        date,
        pairs: pairs.map((p) => ({
            ...p,
            rate: p.base === p.quote ? 1 : found.get(`${p.base}/${p.quote}`) ?? null,
        })),
    };
}

export interface GlobalCrypto {
    /** The whole crypto market in USD, as CoinGecko publishes it. */
    marketCap: number;
    volume24h: number;
}

/**
 * The market as a whole, rather than the coins on screen.
 *
 * Summing the top fifteen would give the top fifteen and call it the
 * market. This is the published figure, and a failure returns zero
 * rather than taking the panel with it — a missing total is a heading
 * without a number, not a broken column.
 */
export async function fetchGlobalCrypto(): Promise<GlobalCrypto> {
    try {
        const res = await fetch("https://api.coingecko.com/api/v3/global");
        if (!res.ok) return { marketCap: 0, volume24h: 0 };
        const data = await res.json() as { data?: { total_market_cap?: Record<string, number>; total_volume?: Record<string, number> } };
        return {
            marketCap: data.data?.total_market_cap?.usd ?? 0,
            volume24h: data.data?.total_volume?.usd ?? 0,
        };
    } catch {
        return { marketCap: 0, volume24h: 0 };
    }
}

/** ECB reference rates, published once a working day. */
export async function fetchRates(
    // Against the dollar, per explicit request: it's what most of the
    // prices on this panel are quoted in, so the rates sit in the same
    // frame of reference as everything beside them.
    base = "USD",
    // Four, per explicit request. The converter beside this list still
    // reaches every currency the ECB publishes (see lib/currencies) —
    // this is the short list worth having on screen, not the limit.
    symbols = ["CZK", "EUR", "AUD", "GBP"],
): Promise<ExchangeRates> {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols.join(",")}`);
    if (!res.ok) throw new Error(`Frankfurter request failed: ${res.status}`);

    const data = await res.json() as { base: string; date: string; rates: Record<string, number> };
    return {
        base: data.base,
        date: data.date,
        rates: Object.entries(data.rates).map(([code, rate]) => ({ code, rate })),
    };
}
