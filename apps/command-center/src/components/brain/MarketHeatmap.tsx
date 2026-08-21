interface HeatCell {
    id: string;
    label: string;
    /** Percent, positive or negative. */
    change: number;
    href: string;
}

/**
 * A diverging scale: two hues away from a neutral middle, three steps
 * each side. Not a rainbow and no hue at the midpoint — flat is grey,
 * and the further a market has moved the deeper its cell goes.
 *
 * Every step is dark enough to carry white text at full contrast, which
 * is what lets the number sit ON the colour: the cell says how much it
 * moved in words as well as in shade, so nothing here depends on
 * telling red from green.
 */
const NEUTRAL = "#2A3140";
const RISING = ["#1E4234", "#1B6044", "#178055"];
const FALLING = ["#45222E", "#67273A", "#8A2B41"];

// Below this a move is noise, and the cell stays neutral rather than
// implying a direction the number doesn't support.
const FLAT = 0.15;

interface MarketHeatmapProps {
    title: string;
    cells: HeatCell[];
}

/**
 * The whole board at once, coloured by how far it moved.
 *
 * The thing a list of rows can't do: two dozen companies in one
 * glance, where the eye finds the deep red corner before it reads a
 * single label. Ordered by company size, biggest first, so a name keeps
 * its place from one day to the next — what changes is its colour.
 *
 * Not a treemap — the version of this you see on trading sites sizes
 * each tile by market capitalisation, and the indices and commodities
 * here have no capitalisation to size by. Equal tiles say the one thing
 * that IS true of all of them: this is how much each moved.
 */
export default function MarketHeatmap({ title, cells }: MarketHeatmapProps) {
    if (cells.length === 0) return null;

    // Kept in the order handed in — largest company first (per explicit
    // request). NOT re-sorted by how far each moved: the point of a
    // board like this is that a name is always in the same place, so
    // you learn where to look. The colour is what varies.
    const ranked = cells;
    const extreme = Math.max(...ranked.map((cell) => Math.abs(cell.change)), 1);

    const shade = (change: number): string => {
        if (Math.abs(change) < FLAT) return NEUTRAL;
        // Square-rooted, so the middle of the range is still visibly
        // coloured instead of everything but the extremes looking flat.
        const depth = Math.sqrt(Math.abs(change) / extreme);
        const step = Math.min(2, Math.floor(depth * 3));
        return change > 0 ? RISING[step] : FALLING[step];
    };

    return (
        <div className="market-heatmap">
            <h3 className="market-group-title">{title}</h3>

            <div className="market-heat-grid">
                {ranked.map((cell) => (
                    <a
                        key={cell.id}
                        className="market-heat-cell"
                        style={{ background: shade(cell.change) }}
                        href={cell.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${cell.label} ${cell.change >= 0 ? "+" : "−"}${Math.abs(cell.change).toFixed(2)}%`}
                    >
                        <span className="market-heat-label">{cell.label}</span>
                        <span className="market-heat-figure">
                            {cell.change >= 0 ? "+" : "−"}{Math.abs(cell.change).toFixed(1)}%
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}
