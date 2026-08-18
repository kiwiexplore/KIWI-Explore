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

/** ECB reference rates, published once a working day. */
export async function fetchRates(base = "EUR", symbols = ["USD", "CZK", "GBP", "JPY"]): Promise<ExchangeRates> {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols.join(",")}`);
    if (!res.ok) throw new Error(`Frankfurter request failed: ${res.status}`);

    const data = await res.json() as { base: string; date: string; rates: Record<string, number> };
    return {
        base: data.base,
        date: data.date,
        rates: Object.entries(data.rates).map(([code, rate]) => ({ code, rate })),
    };
}
