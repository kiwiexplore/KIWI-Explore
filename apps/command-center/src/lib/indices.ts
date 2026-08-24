/**
 * Stock indices, by way of KIWI's own service.
 *
 * The Finance module used to say outright that indices need an API key
 * and so weren't there. That's still true of every equity feed worth
 * having — Yahoo's chart endpoint is the exception, and it sends no
 * CORS header, so the service reads it and this asks the service (see
 * apps/feed-service/src/indices.mjs). With the service down there are
 * simply no indices, and the crypto and currency halves carry on.
 */

export interface IndexQuote {
    symbol: string;
    /** Which board it belongs to — each gets its own group in the panel. */
    group: "index" | "commodity" | "stock";
    /** Stocks only: their place in the curated size ranking. */
    order?: number;
    name: string;
    price: number;
    currency: string;
    change: number;
    changePercent: number;
    /**
     * How much changed hands today, where the feed knows.
     *
     * Deliberately not called a market cap, because it isn't one and
     * one isn't available: Yahoo's chart endpoint has no such field and
     * the two endpoints that do refuse without a session. A coin has a
     * real cap because CoinGecko gives it away; an index has none at
     * all, being an average rather than a company.
     */
    volume: number | null;
    /**
     * Stocks only, from Nasdaq's public API — Yahoo will not give one
     * up without a session. Null for indices and commodities, which do
     * not have one to give: an index is an average rather than a
     * company, and a barrel of oil is neither.
     */
    marketCap: number | null;
    /** What that cap is a total of — "S&P 500 companies". */
    capOf?: string | null;
    /** The year's range — what a single price can't tell you. */
    yearLow: number | null;
    yearHigh: number | null;
    /** The series for whichever span was asked for, oldest first. */
    month: number[];
}

/** The spans the panel can ask for. */
export type MarketSpan = "1d" | "1w" | "1mo" | "1y" | "max";

export const SPAN_LABELS: Record<MarketSpan, string> = {
    "1d": "Day",
    "1w": "Week",
    "1mo": "Month",
    "1y": "Year",
    max: "All",
};

const SERVICE_URL = `${import.meta.env.VITE_FEED_SERVICE ?? ""}/api/indices`;

export async function fetchIndices(span: MarketSpan = "1mo"): Promise<IndexQuote[]> {
    const res = await fetch(`${SERVICE_URL}?span=${span}`);
    if (!res.ok) throw new Error(`feed service responded ${res.status}`);
    const data = await res.json() as { indices?: IndexQuote[] };
    return data.indices ?? [];
}
