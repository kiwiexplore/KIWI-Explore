import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useAsyncData } from "./regionContent/useAsyncData";
import { convert, fetchCurrencyTable } from "../../lib/currencies";

/**
 * Converting between any two currencies the ECB publishes.
 *
 * Lives in the markets panel because that's where the rates already
 * are, and because a rate you can't do arithmetic with is half a
 * feature: the row says EUR/CZK is 24.16, and this is what you actually
 * wanted it for.
 *
 * The whole table is fetched once (see lib/currencies) and every
 * conversion after that is arithmetic — typing in the box does not talk
 * to anyone.
 */
export default function CurrencyConverter() {
    const { data, error, loading } = useAsyncData("currency-table", () => fetchCurrencyTable());
    const [amount, setAmount] = useState("100");
    const [from, setFrom] = useState("USD");
    const [to, setTo] = useState("CZK");

    if (loading) return <div className="currency-converter"><p className="converter-note">Loading rates…</p></div>;
    if (error || !data) return <div className="currency-converter"><p className="converter-note">Rates unavailable right now.</p></div>;

    const codes = Object.keys(data.rates).sort();
    const parsed = Number(amount.replace(",", "."));
    const result = Number.isFinite(parsed) ? convert(data, parsed, from, to) : null;

    const swap = () => {
        setFrom(to);
        setTo(from);
    };

    return (
        <div className="currency-converter">
            <h3 className="market-group-title">Converter</h3>

            <div className="converter-row">
                <input
                    className="converter-amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    aria-label="Amount"
                />
                <select
                    className="converter-pick"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    aria-label="From currency"
                >
                    {codes.map((code) => (
                        <option key={code} value={code}>{code}</option>
                    ))}
                </select>
                <button type="button" className="converter-swap" onClick={swap} aria-label="Swap currencies">
                    <ArrowLeftRight size={13} strokeWidth={2} />
                </button>
                <select
                    className="converter-pick"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    aria-label="To currency"
                >
                    {codes.map((code) => (
                        <option key={code} value={code}>{code}</option>
                    ))}
                </select>
            </div>

            <p className="converter-result">
                {result === null
                    ? "—"
                    : `${result.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${to}`}
            </p>
            <p className="converter-detail">
                {data.names[to] ?? to} · 1 {from} = {(convert(data, 1, from, to) ?? 0).toFixed(4)} {to}
            </p>
            <p className="converter-note">
                ECB reference rates, {data.date}. Not a dealing rate — a
                bank's will be worse.
            </p>
        </div>
    );
}
