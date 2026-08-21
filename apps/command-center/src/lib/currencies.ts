/**
 * Every currency Frankfurter publishes, and one table of rates to
 * convert between them.
 *
 * Fetched ONCE as a full table against a single base rather than per
 * conversion: the European Central Bank publishes these once a working
 * day, so a request per keystroke would be a request per keystroke for
 * the same numbers. Any pair is then arithmetic — rate(to) / rate(from)
 * — which is exactly how a cross rate is defined.
 *
 * Free, keyless, CORS-enabled, and the same source the markets panel's
 * rates come from (see lib/markets.ts).
 */

export interface CurrencyTable {
    base: string;
    date: string;
    /** Units of each currency per one unit of the base. Includes the base. */
    rates: Record<string, number>;
    /** "CZK" → "Czech Koruna", for the pickers. */
    names: Record<string, string>;
}

export async function fetchCurrencyTable(base = "USD"): Promise<CurrencyTable> {
    const [ratesRes, namesRes] = await Promise.all([
        fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`),
        fetch("https://api.frankfurter.dev/v1/currencies"),
    ]);
    if (!ratesRes.ok) throw new Error(`Frankfurter rates failed: ${ratesRes.status}`);
    if (!namesRes.ok) throw new Error(`Frankfurter currency list failed: ${namesRes.status}`);

    const rates = await ratesRes.json() as { base: string; date: string; rates: Record<string, number> };
    const names = await namesRes.json() as Record<string, string>;

    return {
        base: rates.base,
        date: rates.date,
        // The base isn't in its own rate list — it's 1 by definition,
        // and without it every conversion involving it divides by zero.
        rates: { ...rates.rates, [rates.base]: 1 },
        names,
    };
}

/** Amount in `from`, expressed in `to`. Null when either is unknown. */
export function convert(table: CurrencyTable, amount: number, from: string, to: string): number | null {
    const fromRate = table.rates[from];
    const toRate = table.rates[to];
    if (!fromRate || !toRate) return null;
    return (amount / fromRate) * toRate;
}
