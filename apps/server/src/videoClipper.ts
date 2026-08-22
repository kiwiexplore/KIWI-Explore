import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { FFMPEG_BIN, binaryExists, lastLines, runCommand } from "./videoTranscriber.js";
import type { VideoClip } from "./videoGenerator.js";

/**
 * Turns a suggested clip into an actual file.
 *
 * Finding clips only ever produced timestamps — a list saying "12:04 to
 * 12:47 works on its own", which still left the cutting to be done by
 * hand somewhere else. ffmpeg is already on the machine for the audio
 * extraction, so the cut is a short hop from there.
 *
 * One clip per call, deliberately. A clip is thirty to sixty seconds and
 * re-encodes in a few, which fits comfortably inside a request —
 * whereas cutting five of them in one go would need the whole
 * background-job apparatus that transcription has, for work that
 * doesn't take long enough to earn it.
 */

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const clipsDir = path.join(dataDir, "clips");

export class ClippingUnavailableError extends Error {}

export async function checkClippingAvailable(): Promise<void> {
    if (!(await binaryExists(FFMPEG_BIN))) {
        throw new ClippingUnavailableError(
            `ffmpeg isn't available (looked for "${FFMPEG_BIN}"). Install it — on macOS: brew install ffmpeg — or set FFMPEG_BIN in apps/server/.env to its full path.`,
        );
    }
}

/** Where a given clip's file lives. Stable, so re-cutting overwrites. */
export function clipPath(videoId: number, index: number): string {
    return path.join(clipsDir, `${videoId}-${index + 1}.mp4`);
}

/**
 * Cuts one clip and returns the file it wrote.
 *
 * Seeks before -i (fast) but re-encodes rather than stream-copying: a
 * copy can only cut at keyframes, which drags the real start of a clip
 * seconds away from the timestamp that was chosen for it. At this
 * length the encode costs little and the cut lands where it was asked
 * to.
 */
export async function cutClip(videoId: number, sourceVideoPath: string, clip: VideoClip, index: number): Promise<string> {
    if (!fs.existsSync(sourceVideoPath)) {
        throw new Error(`No file at ${sourceVideoPath} — the recording moved or was deleted.`);
    }
    const duration = clip.end - clip.start;
    if (!(duration > 0)) {
        throw new Error(`That clip's timestamps don't make a range (${clip.start}s to ${clip.end}s).`);
    }

    fs.mkdirSync(clipsDir, { recursive: true });
    const out = clipPath(videoId, index);

    const result = await runCommand(FFMPEG_BIN, [
        "-y",
        "-ss", String(clip.start),
        "-i", sourceVideoPath,
        "-t", String(duration),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac",
        // Some sources carry data or subtitle tracks that mp4 refuses;
        // the clip only ever needs the first video and audio stream.
        "-map", "0:v:0", "-map", "0:a:0?",
        out,
    ]);

    if (result.code !== 0) {
        // Leave nothing half-written behind — a truncated file that
        // looks like a finished clip is worse than no file.
        fs.rmSync(out, { force: true });
        throw new Error(`ffmpeg couldn't cut that clip (exit ${result.code}). ${lastLines(result.stderr)}`);
    }
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
        fs.rmSync(out, { force: true });
        throw new Error("ffmpeg reported success but wrote an empty file.");
    }
    return out;
}
