import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
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

/**
 * Whether this ffmpeg can burn text in.
 *
 * drawtext needs libfreetype at build time and plenty of builds ship
 * without it — Homebrew's among them. Discovering that by failing the
 * whole render would trade a finished picture for a missing caption,
 * which is the wrong trade; the export goes ahead and says what it
 * couldn't do.
 *
 * Probed once: the answer cannot change while the process runs.
 */
let hasDrawText: boolean | null = null;

export async function canBurnText(): Promise<boolean> {
    if (hasDrawText !== null) return hasDrawText;
    try {
        // Actually USE the filter on a scrap of black and throw the
        // result away. Asking `-filters` or `-h filter=…` answers on
        // stdout, and reading the wrong stream is how the first version
        // of this concluded the filter was present right up until the
        // render failed on it.
        const probe = await runCommand(FFMPEG_BIN, [
            "-hide_banner", "-f", "lavfi", "-i", "color=c=black:s=16x16:d=0.1",
            "-vf", "drawtext=text=x", "-frames:v", "1", "-f", "null", "-",
        ]);
        hasDrawText = probe.code === 0;
    } catch {
        hasDrawText = false;
    }
    return hasDrawText;
}

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

export interface ExportText {
    text: string;
    start: number;
    duration: number;
}

export interface ExportRequest {
    clips: ExportClip[];
    texts: ExportText[];
    width: number;
    height: number;
    /** Seconds of crossfade at each join, or 0 for hard cuts. */
    crossfade: number;
}

/** Everything ffmpeg's drawtext treats as syntax rather than as text. */
function escapeDrawText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "’")
        .replace(/%/g, "\\%")
        .replace(/\n/g, " ");
}

function safeFile(file: string): string {
    // Ids are generated here, never supplied — but an export writes a
    // path from them, so anything that could climb out of uploads is
    // rejected rather than sanitised into something surprising.
    if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) {
        throw new Error(`Refusing a media id that isn't a plain filename: ${file}`);
    }
    const full = path.join(uploadsDir, file);
    if (!fs.existsSync(full)) throw new Error(`That media isn't on the server any more: ${file}`);
    return full;
}

/**
 * Builds the filter graph. Every clip is trimmed to its slice, delayed
 * to its position, and laid over a black canvas in timeline order, so
 * gaps stay black instead of collapsing the way a concat would.
 */
function buildGraph(request: ExportRequest, burnText: boolean): { args: string[]; filter: string; map: string[] } {
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
        args.push("-ss", String(clip.offset), "-t", String(clip.duration), "-i", safeFile(clip.file));
    });

    let base = "[0:v]";
    video.forEach((clip) => {
        const input = request.clips.indexOf(clip) + 2;
        parts.push(`[${input}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:-1:-1:color=black,setpts=PTS-STARTPTS[v${input}]`);
        parts.push(`${base}[v${input}]overlay=enable='between(t,${clip.start},${clip.start + clip.duration})':x=0:y=0[b${input}]`);
        base = `[b${input}]`;
    });

    // Text last, so it sits over the picture rather than under the next
    // clip's overlay.
    let withText = base;
    (burnText ? request.texts : []).forEach((text, i) => {
        const out = `[t${i}]`;
        parts.push(`${withText}drawtext=text='${escapeDrawText(text.text)}':fontcolor=white:fontsize=${Math.round(height / 18)}:borderw=3:bordercolor=black@0.85:x=(w-text_w)/2:y=h-(h*0.12):enable='between(t,${text.start},${text.start + text.duration})'${out}`);
        withText = out;
    });

    const audioLabels: string[] = ["[1:a]"];
    audio.forEach((clip) => {
        const input = request.clips.indexOf(clip) + 2;
        parts.push(`[${input}:a]adelay=${Math.round(clip.start * 1000)}|${Math.round(clip.start * 1000)},apad[a${input}]`);
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

export async function renderExport(id: number, request: ExportRequest): Promise<ExportResult> {
    if (request.clips.length === 0) throw new Error("There's nothing on the timeline to export.");

    const burnText = await canBurnText();
    const warnings: string[] = [];
    if (!burnText && request.texts.length > 0) {
        warnings.push(`This ffmpeg has no drawtext filter, so ${request.texts.length} text ${request.texts.length === 1 ? "overlay was" : "overlays were"} left out. The picture and sound are complete. A build with libfreetype (on macOS: brew install ffmpeg) would include them.`);
    }

    fs.mkdirSync(exportsDir, { recursive: true });
    const out = path.join(exportsDir, `${id}.mp4`);
    const { args, filter, map } = buildGraph(request, burnText);

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
}
