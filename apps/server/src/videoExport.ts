import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { FFMPEG_BIN, binaryExists, lastLines, runCommand } from "./videoTranscriber.js";

/**
 * Rendering an edit into one file.
 *
 * The editor holds its media as object URLs in the browser, which the
 * server cannot see — so an export needs the bytes here first. Uploaded
 * media lands in data/uploads and an edit refers to it by id, which
 * also means a project survives a reload rather than living only as
 * long as the tab.
 *
 * The render itself is one ffmpeg invocation with a filter graph rather
 * than a concat of intermediate files: intermediates double the disk
 * write and force a re-encode per clip, and any crossfade has to span
 * the join anyway.
 */

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
export const uploadsDir = path.join(dataDir, "uploads");
export const exportsDir = path.join(dataDir, "exports");

export class ExportUnavailableError extends Error {}

export async function checkExportAvailable(): Promise<void> {
    if (!(await binaryExists(FFMPEG_BIN))) {
        throw new ExportUnavailableError(
            `ffmpeg isn't available (looked for "${FFMPEG_BIN}"). Install it — on macOS: brew install ffmpeg — or set FFMPEG_BIN in apps/server/.env to its full path.`,
        );
    }
}

export interface ExportClip {
    /** The uploaded file this clip plays. */
    file: string;
    /** Where it sits on the timeline, in seconds. */
    start: number;
    duration: number;
    /** Where playback starts inside the source. */
    offset: number;
    kind: "video" | "audio";
}

/**
 * A caption, already drawn.
 *
 * Text used to be burned in with drawtext, which needs libfreetype at
 * build time — and Homebrew's plain ffmpeg bottle has neither that nor
 * libass, so every export with subtitles went out without them and said
 * so. The browser draws them now and sends the pictures, and they go on
 * with `overlay`, which every build has.
 *
 * The gain is not only that it works: the caption in the file is drawn
 * by the same engine, with the same font and wrapping, as the one over
 * the preview.
 */
export interface ExportText {
    text: string;
    start: number;
    duration: number;
    /** PNG bytes, base64. Without one there is nothing to draw. */
    png?: string;
    /** Where the picture goes, in frame pixels from the top left. */
    x?: number;
    y?: number;
}

export interface ExportRequest {
    clips: ExportClip[];
    texts: ExportText[];
    width: number;
    height: number;
    /** Seconds of crossfade at each join, or 0 for hard cuts. */
    crossfade: number;
}

/**
 * Resolves one clip's media inside the folder it is allowed to come
 * from — the project's own folder now that projects have one, falling
 * back to the upload store for edits made before they did.
 *
 * The name arrives from a request, so this is the boundary: a path that
 * resolves outside the folder is refused rather than normalised into
 * something surprising.
 */
function safeFile(file: string, folder: string): string {
    if (file.includes("..") || path.isAbsolute(file)) {
        throw new Error(`Refusing a media name that isn't inside the project: ${file}`);
    }
    const root = path.resolve(folder);
    const full = path.resolve(root, file);
    if (full !== root && !full.startsWith(root + path.sep)) {
        throw new Error(`Refusing a media name that isn't inside the project: ${file}`);
    }
    if (!fs.existsSync(full)) throw new Error(`That media isn't in the project's folder any more: ${file}`);
    return full;
}

/**
 * Builds the filter graph. Every clip is trimmed to its slice, delayed
 * to its position, and laid over a black canvas in timeline order, so
 * gaps stay black instead of collapsing the way a concat would.
 */
function buildGraph(request: ExportRequest, captionFiles: string[], folder: string): { args: string[]; filter: string; map: string[] } {
    const { width, height } = request;
    const video = request.clips.filter((c) => c.kind === "video");
    const audio = request.clips;

    const total = request.clips.reduce((end, c) => Math.max(end, c.start + c.duration), 0);
    const args: string[] = [];
    const parts: string[] = [];

    // A black canvas exactly as long as the edit. Everything composites
    // onto this, which is what makes a gap a gap.
    args.push("-f", "lavfi", "-t", String(total), "-i", `color=c=black:s=${width}x${height}:r=25`);
    args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");

    request.clips.forEach((clip) => {
        args.push("-ss", String(clip.offset), "-t", String(clip.duration), "-i", safeFile(clip.file, folder));
    });

    // Clips composite in timeline order, each over what came before.
    //
    // A crossfade is simply an OVERLAP: where a clip starts before the
    // previous one ends, the incoming clip fades its alpha in across
    // that overlap and the two are seen through each other. There is no
    // separate transition object and no control to set — dragging a clip
    // onto its neighbour is the transition, which is both how editors
    // work and the only version of this that can't disagree with what
    // the timeline shows.
    const ordered = [...video].sort((a, b) => a.start - b.start);
    let base = "[0:v]";
    ordered.forEach((clip, i) => {
        const input = request.clips.indexOf(clip) + 2;
        const previous = ordered[i - 1];
        const overlap = previous
            ? Math.max(0, Math.min(previous.start + previous.duration - clip.start, clip.duration, previous.duration))
            : 0;

        const chain = [
            `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
            `pad=${width}:${height}:-1:-1:color=black`,
            // Shifted to WHERE IT SITS, not just zeroed.
            //
            // overlay pairs frames by timestamp, so a clip whose PTS
            // starts at 0 plays from its own beginning at base time 0
            // and is merely made visible later by `enable`. It looked
            // right until two clips were laid over each other and the
            // second one turned out to be showing the wrong moment —
            // and any alpha fade timed from the clip's start was long
            // over by the time the clip appeared.
            `setpts=PTS-STARTPTS+${clip.start.toFixed(3)}/TB`,
        ];
        if (overlap > 0.04) {
            // yuva420p first: fade can only touch an alpha channel on a
            // pixel format that has one, and without it the fade is
            // accepted and silently does nothing.
            chain.push("format=yuva420p", `fade=t=in:st=${clip.start.toFixed(3)}:d=${overlap.toFixed(3)}:alpha=1`);
        }
        parts.push(`[${input}:v]${chain.join(",")}[v${input}]`);
        parts.push(`${base}[v${input}]overlay=enable='between(t,${clip.start},${clip.start + clip.duration})':x=0:y=0[b${input}]`);
        base = `[b${input}]`;
    });

    // Captions last, so they sit over the picture rather than under the
    // next clip's overlay.
    //
    // Each is a one-frame PNG input. overlay's default eof_action is to
    // repeat the last frame it has, so a single frame covers however
    // long the caption is on screen without decoding it again — and
    // `enable` is what decides when that is.
    const captionInput = request.clips.length + 2;
    let withText = base;
    captionFiles.forEach((file, i) => {
        args.push("-i", file);
        const text = request.texts[i];
        const out = `[t${i}]`;
        parts.push(`${withText}[${captionInput + i}:v]overlay=x=${Math.round(text.x ?? 0)}:y=${Math.round(text.y ?? 0)}:enable='between(t,${text.start},${text.start + text.duration})'${out}`);
        withText = out;
    });

    const audioLabels: string[] = ["[1:a]"];
    audio.forEach((clip) => {
        const input = request.clips.indexOf(clip) + 2;
        // adelay already places audio at its timeline position, which
        // is why the picture being out of place went unnoticed for as
        // long as it did.
        const at = Math.round(clip.start * 1000);
        parts.push(`[${input}:a]asetpts=PTS-STARTPTS,adelay=${at}|${at},apad[a${input}]`);
        audioLabels.push(`[a${input}]`);
    });
    parts.push(`${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=first:dropout_transition=0[aout]`);

    return { args, filter: parts.join(";"), map: [withText === base ? base : withText, "[aout]"] };
}

export interface ExportResult {
    file: string;
    /** What the render could not do, said plainly rather than hidden. */
    warnings: string[];
}

/**
 * Renders into the project's own Exports folder when it has one, so the
 * finished film lands beside the footage it was cut from rather than
 * inside the app's private store where nobody would think to look.
 */
export async function renderExport(id: number, request: ExportRequest, folder?: string): Promise<ExportResult> {
    if (request.clips.length === 0) throw new Error("There's nothing on the timeline to export.");
    const mediaFolder = folder || uploadsDir;
    const outDir = folder ? path.join(folder, "Exports") : exportsDir;

    const warnings: string[] = [];
    // A caption that arrived without a picture is the one thing this
    // can't draw, and it is said rather than dropped in silence.
    const undrawn = request.texts.filter((t) => !t.png).length;
    if (undrawn > 0) {
        warnings.push(`${undrawn} ${undrawn === 1 ? "caption" : "captions"} arrived without a rendered image and ${undrawn === 1 ? "was" : "were"} left out. The picture and sound are complete.`);
    }

    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${id}.mp4`);

    // The PNGs live only as long as the render. They are the browser's
    // output, not anything worth keeping — the timeline still holds the
    // words, and drawing them again costs a millisecond.
    const captionDir = fs.mkdtempSync(path.join(os.tmpdir(), `kiwi-captions-${id}-`));
    try {
        const captionFiles: string[] = [];
        request.texts.forEach((text, i) => {
            if (!text.png) return;
            const file = path.join(captionDir, `${i}.png`);
            fs.writeFileSync(file, Buffer.from(text.png, "base64"));
            captionFiles.push(file);
        });
        // buildGraph pairs captionFiles[i] with texts[i], so a text
        // without a picture must not leave a hole in the list.
        const drawable = { ...request, texts: request.texts.filter((t) => t.png) };
        const { args, filter, map } = buildGraph(drawable, captionFiles, mediaFolder);

        const result = await runCommand(FFMPEG_BIN, [
            "-y",
            ...args,
            "-filter_complex", filter,
            "-map", map[0],
            "-map", map[1],
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            out,
        ]);

        if (result.code !== 0) {
            fs.rmSync(out, { force: true });
            throw new Error(`ffmpeg couldn't render the export (exit ${result.code}). ${lastLines(result.stderr, 4)}`);
        }
        if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
            fs.rmSync(out, { force: true });
            throw new Error("ffmpeg reported success but wrote an empty file.");
        }
        return { file: out, warnings };
    } finally {
        fs.rmSync(captionDir, { recursive: true, force: true });
    }
}
