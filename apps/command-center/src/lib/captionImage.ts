import { DEFAULT_TEXT_STYLE, type TextStyle } from "../state/studioEditor";

/**
 * Captions, drawn by the browser and handed to the render as pictures.
 *
 * ffmpeg's drawtext needs libfreetype at build time, and plenty of
 * builds ship without it — Homebrew's plain `ffmpeg` bottle among them,
 * which is why exports have been going out with the captions missing
 * and a warning attached. Its `subtitles` filter is no help either: it
 * needs libass, which that bottle also leaves out.
 *
 * So the text is rasterised here instead, and composited with `overlay`
 * — a filter every build has. That trades a build dependency for a few
 * kilobytes per caption, and it buys something the drawtext version
 * could not have: the burned-in caption is drawn by the same engine,
 * with the same font, wrapping and shadow, as the one over the preview.
 * What you were looking at is what lands in the file.
 */

/** Matches .studio-caption's 8% side inset. */
const SIDE_INSET = 0.08;
const LINE_HEIGHT = 1.35;

export interface CaptionImage {
    start: number;
    duration: number;
    /** PNG bytes, base64, no data: prefix. */
    png: string;
    /** Where the box goes on the frame, in pixels from the top left. */
    x: number;
    y: number;
}

/** The font the preview is using, read off the page so the two cannot
 *  drift apart by editing one of them. */
function captionFont(size: number, weight = 650): string {
    const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    return `${weight} ${size}px ${family}`;
}

/** Greedy wrap at the box width — the same result CSS gives for text
 *  this short, without pulling in a line-breaking algorithm for it. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [text];
}

/**
 * Draws one caption onto a transparent canvas the size of its own box.
 *
 * A box rather than a full frame: a 1080p transparent PNG per caption
 * would be most of a megabyte of nothing, and the placement it saves is
 * two numbers.
 */
export function renderCaption(
    text: string,
    start: number,
    duration: number,
    frameWidth: number,
    frameHeight: number,
    style: TextStyle = DEFAULT_TEXT_STYLE,
): CaptionImage | null {
    // Every figure in a style is a fraction of the frame, so the same
    // caption lands in the same place whether this is rendering 1920
    // wide or 1080 (Sprint 120). A size in pixels would be twice as big
    // in one of them.
    const fontSize = Math.max(10, Math.round(frameWidth * style.size));
    const boxWidth = Math.round(frameWidth * (1 - SIDE_INSET * 2));

    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) return null;
    measure.font = captionFont(fontSize, style.weight);
    const lines = wrap(measure, text, boxWidth);

    const lineHeight = Math.round(fontSize * LINE_HEIGHT);
    // Room for the shadow to fall outside the glyphs without being cut
    // off at the edge of the box.
    const pad = Math.ceil(fontSize * 0.4);
    const boxHeight = lines.length * lineHeight + pad * 2;

    const canvas = document.createElement("canvas");
    canvas.width = boxWidth;
    canvas.height = boxHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // The band goes down first, under everything, so the words and
    // their shadow sit on it rather than under it.
    if (style.band) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, boxWidth, boxHeight);
    }

    ctx.font = captionFont(fontSize, style.weight);
    ctx.textAlign = style.align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = style.color;
    const x = style.align === "left" ? pad : style.align === "right" ? boxWidth - pad : boxWidth / 2;

    // The preview's two text-shadows, in proportion to the type rather
    // than at the fixed pixel sizes the CSS names — those were written
    // for a caption a third of this size.
    const passes = [
        { color: "rgba(0,0,0,0.9)", blur: fontSize * 0.225, offset: fontSize * 0.075 },
        { color: "rgba(0,0,0,1)", blur: fontSize * 0.075, offset: 0 },
    ];
    for (const pass of passes) {
        ctx.shadowColor = pass.color;
        ctx.shadowBlur = pass.blur;
        ctx.shadowOffsetY = pass.offset;
        lines.forEach((line, i) => {
            ctx.fillText(line, x, pad + i * lineHeight + lineHeight / 2);
        });
    }

    const png = canvas.toDataURL("image/png").split(",")[1] ?? "";
    if (!png) return null;

    return {
        start,
        duration,
        png,
        x: Math.round(frameWidth * SIDE_INSET),
        // `y` in a style is the MIDDLE of the text, which is what the
        // preview positions by — so the box is placed half its height
        // above it.
        y: Math.max(0, Math.round(frameHeight * style.y - boxHeight / 2)),
    };
}
