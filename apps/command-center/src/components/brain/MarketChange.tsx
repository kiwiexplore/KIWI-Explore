interface ChangeBar {
    id: string;
    label: string;
    /** Percent, positive or negative. */
    change: number;
    href: string;
}

// The two ends of the scale, and the neutral the zero line sits in.
// Diverging, not categorical: the hue carries direction, and direction
// has exactly two values.
const UP = "#3FAE79";
const DOWN = "#D9536A";

interface MarketChangeProps {
    title: string;
    bars: ChangeBar[];
}

/**
 * How far each market has moved, side by side.
 *
 * This slot used to hold a ring of crypto market caps. It was asked to
 * be about indices, stocks and commodities instead — and those cannot
 * honestly be a ring. A pie says "these are shares of one whole", and
 * the S&P at 7,708 next to natural gas at 2.75 is not a share of
 * anything: drawn as slices, the index would swallow 99% of the circle
 * and the picture would state something false about the market.
 *
 * What those instruments DO have in common is a percentage move, and
 * that is a comparison — so it's bars against a shared zero, sorted by
 * size, longest first. Same question ("what's moving"), a shape that
 * can answer it.
 *
 * Direction is in the hue AND in the side of the line the bar falls on
 * AND in the signed number printed beside it, so nothing here depends
 * on telling red from green.
 */
export default function MarketChange({ title, bars }: MarketChangeProps) {
    if (bars.length === 0) return null;

    const ranked = [...bars].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    // Scaled to the biggest move present rather than to a fixed range,
    // so a quiet week still reads as a shape instead of a flat line.
    const extreme = Math.max(...ranked.map((bar) => Math.abs(bar.change)), 0.5);

    return (
        <div className="market-change">
            <h3 className="market-group-title">{title}</h3>

            <ul className="market-change-list">
                {ranked.map((bar) => {
                    const width = (Math.abs(bar.change) / extreme) * 50;
                    const rising = bar.change >= 0;
                    return (
                        <li key={bar.id}>
                            <a
                                className="market-change-row"
                                href={bar.href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span className="market-change-label">{bar.label}</span>
                                <span className="market-change-track">
                                    {/* The zero line the bars hang off. */}
                                    <span className="market-change-axis" />
                                    <span
                                        className="market-change-bar"
                                        style={{
                                            background: rising ? UP : DOWN,
                                            width: `${width}%`,
                                            left: rising ? "50%" : `${50 - width}%`,
                                        }}
                                    />
                                </span>
                                <span className="market-change-figure">
                                    {rising ? "+" : "−"}{Math.abs(bar.change).toFixed(1)}%
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
