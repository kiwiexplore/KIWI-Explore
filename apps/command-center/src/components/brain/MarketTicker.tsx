import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAsyncData } from "./regionContent/useAsyncData";
import { indicesFor, marketsData } from "./regionContent/dataSources";
import { SPAN_LABELS, type MarketSpan } from "../../lib/indices";
import Sparkline from "./regionContent/Sparkline";
import MarketChange from "./MarketChange";
import MarketHeatmap from "./MarketHeatmap";
import CurrencyConverter from "./CurrencyConverter";
import "./MarketTicker.css";

// How long each set holds before the next one slides in. Slow enough to
// read a line without chasing it.
const HOLD_MS = 5000;
// Roughly what one quote occupies — name, figure, line, move, gap. Used
// to work out how many fit rather than fixing a number: the bar is
// whatever width the window leaves between the brand and the tools, and
// a fixed count either leaves it half empty or overflows it.
//
// Measured against the widest case rather than the average. Too small
// and the row overflows, flex shrinks every quote to fit, and the first
// thing to go is the name — which is exactly what makes a line of
// charts unreadable: you can see that something moved 4% and not what.
const QUOTE_WIDTH = 190;
const MIN_VISIBLE = 2;
// Three at most, per explicit request: four fitted only by squeezing,
// and a quote whose name has been squeezed away is a chart of nothing.
const MAX_VISIBLE = 3;
// What to show before anything has been measured — the full count
// rather than the minimum, so the first paint isn't a nearly empty bar.
const DEFAULT_VISIBLE = 3;

interface Quote {
    id: string;
    /** Where to read more about it — see quoteHref. */
    href: string;
    /** BTC, S&P 500, USD — whatever the row is called. */
    label: string;
    value: string;
    /** Percent move, where the instrument has one. FX doesn't. */
    change: number | null;
    /** The series behind the number, for the line. */
    series: number[];
}

/**
 * Where a quote goes when it's clicked.
 *
 * Yahoo Finance for anything with a market symbol (its quote pages carry
 * the full chart, the fundamentals and the news for that instrument) and
 * CoinGecko for coins, which is where the coin figures on this bar come
 * from in the first place — so the number you clicked and the page you
 * land on are the same source, not two that disagree.
 */
function quoteHref(kind: "symbol" | "coin" | "fx", id: string): string {
    if (kind === "coin") return `https://www.coingecko.com/en/coins/${id}`;
    if (kind === "fx") return `https://finance.yahoo.com/quote/${id}=X`;
    return `https://finance.yahoo.com/quote/${encodeURIComponent(id)}`;
}

function formatPrice(value: number): string {
    if (value >= 1000) return Math.round(value).toLocaleString();
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(4);
}

/**
 * Markets across the top of the dashboard.
 *
 * One line, in the gap between the brand and the tools — the slot the
 * hardcoded "no new activity" sentence used to occupy. It shows a few
 * instruments at a time and rotates through the rest, because the row
 * is one line and there are three asset classes to get through.
 *
 * Clicking it drops the whole thing open: every index, every coin and
 * every rate at once, each with the shape of its own recent history.
 * A ticker answers "what's moving"; the open panel answers "moving
 * from where", and those are different questions that want different
 * amounts of screen.
 *
 * Everything here shares the "markets" cache with the Finance module
 * (see dataSources) — the bar costs no extra requests, and it warms
 * exactly what that module will want.
 */
export default function MarketTicker() {
    const { data, loading } = useAsyncData("markets", marketsData);
    // The span the charts are drawn over. Its own fetch and its own
    // cache key, so switching back to one you've already seen is
    // instant and the coins and rates aren't refetched with it.
    // Opens on the day, per explicit request: what a glance at a
    // markets bar is usually asking is "what's happening now".
    const [span, setSpan] = useState<MarketSpan>("1d");
    const boards = useAsyncData(`indices-${span}`, indicesFor(span));
    const [open, setOpen] = useState(false);
    const [offset, setOffset] = useState(0);
    const [visible, setVisible] = useState(DEFAULT_VISIBLE);
    const observerRef = useRef<ResizeObserver | null>(null);

    // The bar's width is whatever the window leaves it, and it changes
    // with the window — so the count is measured, not guessed.
    //
    // Attached through a CALLBACK ref rather than in an effect: this
    // component renders a different element while it's still loading,
    // and an effect that ran once ended up watching that first element
    // for ever. It was detached the moment the quotes arrived, never
    // measured again, and the bar sat at its minimum of two no matter
    // how wide it was.
    const barRef = (bar: HTMLDivElement | null) => {
        observerRef.current?.disconnect();
        if (!bar) return;

        const measure = () => {
            // A width of zero is not a narrow bar, it's a bar that isn't
            // being laid out — a hidden tab, a display:none ancestor, the
            // instant before first paint. Measuring it would collapse the
            // row to its minimum and leave it there, since nothing
            // resizes afterwards. Keep the last good count instead.
            if (bar.clientWidth === 0) return;

            const fits = Math.floor(bar.clientWidth / QUOTE_WIDTH);
            setVisible(Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, fits)));
        };
        measure();

        observerRef.current = new ResizeObserver(measure);
        observerRef.current.observe(bar);
    };

    const quoteFrom = (group: "index" | "commodity" | "stock"): Quote[] =>
        (boards.data ?? []).filter((item) => item.group === group).map((item) => ({
            id: item.symbol,
            label: item.name,
            value: formatPrice(item.price),
            change: item.changePercent,
            series: item.month,
            href: quoteHref("symbol", item.symbol),
        }));

    const indices = quoteFrom("index");
    const commodities = quoteFrom("commodity");
    const stocks = quoteFrom("stock");

    const coins: Quote[] = (data?.coins ?? []).map((coin) => ({
        id: coin.id,
        label: coin.symbol,
        value: `$${formatPrice(coin.price)}`,
        change: coin.change24h,
        series: coin.week,
        href: quoteHref("coin", coin.id),
    }));

    const rates: Quote[] = (data?.rates.rates ?? []).map((rate) => ({
        id: rate.code,
        // Read as "one euro buys this much", which is what the number is.
        label: `${data?.rates.base}/${rate.code}`,
        value: rate.rate.toFixed(3),
        change: null,
        series: [],
        href: quoteHref("fx", `${data?.rates.base}${rate.code}`),
    }));

    const all = [...indices, ...commodities, ...stocks, ...coins, ...rates];

    // How many quotes there are, kept in a ref so the timer below
    // doesn't depend on it. It changes whenever a price updates, and an
    // interval rebuilt on every update never gets to run its full term
    // — the row would turn over at whatever rhythm the data happened to
    // arrive in rather than the one set here.
    const countRef = useRef(all.length);
    useEffect(() => { countRef.current = all.length; }, [all.length]);

    // Rotation pauses while the panel is open — nothing should move
    // under the cursor of someone reading it.
    useEffect(() => {
        if (open) return;
        const timer = window.setInterval(() => {
            const count = countRef.current;
            if (count > visible) setOffset((current) => (current + visible) % count);
        }, HOLD_MS);
        return () => window.clearInterval(timer);
    }, [open, visible]);

    if (loading && boards.loading && all.length === 0) {
        return <div className="market-ticker market-ticker-quiet" ref={barRef}>Reading the markets…</div>;
    }
    if (all.length === 0) return <div className="market-ticker" ref={barRef} />;

    // Wraps around the end rather than stopping short, so the last set
    // is as full as every other one.
    const window_ = Array.from({ length: Math.min(visible, all.length) },
        (_, i) => all[(offset + i) % all.length]);

    return (
        <div className="market-ticker-shell">
            {/* Not one big button any more: every quote is its own link
                out to that instrument's page, so the row had to stop
                being a single control. The chevron beside them is what
                opens the panel. */}
            <div className={`market-ticker${open ? " market-ticker-open" : ""}`} ref={barRef}>
                {window_.map((quote) => (
                    <a
                        key={quote.id}
                        className="ticker-quote"
                        href={quote.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="ticker-label">{quote.label}</span>
                        <span className="ticker-value">{quote.value}</span>
                        {quote.series.length > 1 && (
                            <span className="ticker-line">
                                <Sparkline values={quote.series} rising={(quote.change ?? 0) >= 0} />
                            </span>
                        )}
                        {quote.change !== null && (
                            <span className={`ticker-change ${quote.change >= 0 ? "module-up" : "module-down"}`}>
                                {quote.change >= 0 ? "▲" : "▼"} {Math.abs(quote.change).toFixed(1)}%
                            </span>
                        )}
                    </a>
                ))}
                <button
                    type="button"
                    className="ticker-toggle"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                    aria-label={open ? "Close markets" : "Open markets"}
                >
                    <ChevronDown size={14} strokeWidth={2} className="ticker-chevron" />
                </button>
            </div>

            {open && (
                <>
                    {/* Click anywhere else to put it away. */}
                    <div className="market-scrim" onClick={() => setOpen(false)} />
                    <section className="market-panel">
                        {/* The span applies to everything the service
                            draws — indices, commodities and stocks. The
                            coins keep their own week (CoinGecko gives one
                            series and it isn't this one) and the rates
                            have no series at all, which is why both say
                            their own period in their heading. */}
                        <div className="market-spans">
                            {(Object.keys(SPAN_LABELS) as MarketSpan[]).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={`market-span${option === span ? " market-span-on" : ""}`}
                                    onClick={() => setSpan(option)}
                                    aria-pressed={option === span}
                                >
                                    {SPAN_LABELS[option]}
                                </button>
                            ))}
                            {boards.loading && <span className="market-span-note">loading…</span>}
                        </div>

                        <MarketGroup title={`Indices · ${SPAN_LABELS[span]}`} quotes={indices} note={
                            indices.length === 0 && !boards.loading
                                ? "Indices, commodities and stocks come through KIWI's own feed service, which isn't answering."
                                : undefined
                        } />
                        <MarketGroup title={`Commodities · ${SPAN_LABELS[span]}`} quotes={commodities} />
                        <MarketGroup title="Crypto · 24h · 7d line" quotes={coins} />
                        <MarketHeatmap
                            title={`Stocks · ${SPAN_LABELS[span]} · largest first`}
                            cells={stocks.map((quote) => ({
                                id: quote.id,
                                label: quote.label,
                                change: quote.change ?? 0,
                                href: quote.href,
                            }))}
                        />
                        <MarketChange
                            title={`Movers · ${SPAN_LABELS[span]}`}
                            bars={[...indices, ...commodities]
                                .filter((quote) => quote.change !== null)
                                .map((quote) => ({
                                    id: quote.id,
                                    label: quote.label,
                                    change: quote.change as number,
                                    href: quote.href,
                                }))}
                        />

                        {/* Currencies last, across the full width: they
                            have no chart to compare and the converter is
                            a tool rather than a reading. */}
                        <div className="market-currencies">
                            <MarketGroup
                                title={`Rates · ${data?.rates.base} · ${data?.rates.date}`}
                                quotes={rates}
                                note="European Central Bank reference rates, published once a working day."
                            />
                            <CurrencyConverter />
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

function MarketGroup({ title, quotes, note }: { title: string; quotes: Quote[]; note?: string }) {
    return (
        <div className="market-group">
            <h3 className="market-group-title">{title}</h3>
            {note && <p className="market-note">{note}</p>}
            <ul className="market-rows">
                {quotes.map((quote) => (
                    <li key={quote.id}>
                        <a
                            className="market-row"
                            href={quote.href}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                        <span className="market-row-label">{quote.label}</span>
                        <span className="market-row-value">{quote.value}</span>
                        <span className="market-row-line">
                            {quote.series.length > 1 && (
                                <Sparkline values={quote.series} rising={(quote.change ?? 0) >= 0} />
                            )}
                        </span>
                        <span className={`market-row-change ${
                            quote.change === null ? "" : quote.change >= 0 ? "module-up" : "module-down"
                        }`}>
                            {quote.change === null
                                ? "—"
                                : `${quote.change >= 0 ? "▲" : "▼"} ${Math.abs(quote.change).toFixed(2)}%`}
                        </span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
