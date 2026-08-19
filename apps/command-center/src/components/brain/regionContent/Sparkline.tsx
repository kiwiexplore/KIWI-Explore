interface SparklineProps {
    /** Oldest first. Fewer than two and nothing is drawn. */
    values: number[];
    /** Colours the line; the shape carries the same story on its own. */
    rising: boolean;
}

// Drawn in its own 0-100 x 0-30 space and stretched to whatever width
// the row gives it (preserveAspectRatio="none"), so the line always
// spans the cell exactly.
const WIDTH = 100;
const HEIGHT = 30;
// Room for the stroke, so a week's high or low isn't clipped in half.
const PADDING = 2;

/**
 * A week of prices as a line, next to the number.
 *
 * A percentage says what changed since yesterday and nothing about how
 * it got there: flat-since-yesterday looks identical whether the week
 * was calm or a round trip through a crash. The line is the part a
 * figure can't carry, which is the whole reason it's here rather than a
 * second number.
 */
export default function Sparkline({ values, rising }: SparklineProps) {
    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = WIDTH / (values.length - 1);

    const points = values
        .map((value, index) => {
            const x = index * step;
            // SVG y grows downward, so the highest price is the smallest y.
            const y = PADDING + (1 - (value - min) / span) * (HEIGHT - PADDING * 2);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

    return (
        <svg
            className={`sparkline ${rising ? "sparkline-up" : "sparkline-down"}`}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            // The figure beside it is the accessible version of this.
            aria-hidden="true"
        >
            <polyline points={points} />
        </svg>
    );
}
