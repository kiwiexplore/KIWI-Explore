import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { markTranscriptDone, markTranscriptFailed, markTranscriptProcessing, saveDetectedLanguage } from "./db.js";

/**
 * Video Studio's transcription job: ffmpeg pulls the audio out, whisper
 * runs locally over it. No cloud STT, so nothing about a recording
 * leaves the machine, and no API key is needed for this particular step
 * — the cost is that both binaries have to actually exist, which is
 * checked up front and reported as a real failure rather than a hang.
 *
 * Everything in here funnels into exactly two outcomes: markTranscriptDone
 * with a real file, or markTranscriptFailed with a message a person can
 * act on. There is deliberately no third path where the job just stops —
 * a transcript that silently never arrives is the failure mode this
 * whole feature was specified against.
 */

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const audioDir = path.join(dataDir, "audio");
const transcriptDir = path.join(dataDir, "transcripts");

export const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";
const WHISPER_BIN = process.env.WHISPER_BIN || "whisper-cli";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "";

// One at a time. whisper.cpp will happily saturate every core, so a
// second concurrent job doesn't finish sooner — it just makes both
// slower. Personal mode, single owner, so an in-memory set is enough;
// a restart clears it, and failInterruptedTranscripts() (see db.ts)
// cleans up the rows that set was tracking.
const running = new Set<number>();

export function isTranscribing(id: number): boolean {
    return running.has(id);
}

export class TranscriptionUnavailableError extends Error {}

export function runCommand(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(bin, args);
        let stderr = "";
        child.stderr.on("data", (chunk) => { stderr += String(chunk); });
        // ENOENT lands here rather than as an exit code — a missing
        // binary never starts in the first place.
        child.on("error", reject);
        child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
    });
}

export async function binaryExists(bin: string): Promise<boolean> {
    try {
        // Both tools exit non-zero for a bare --help on some builds, so
        // the exit code is ignored on purpose: the only question here is
        // whether the process could be spawned at all.
        await runCommand(bin, ["--help"]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Checked before a job is accepted, so the route can answer 503 with
 * setup instructions instead of queueing work that cannot run.
 */
export async function checkTranscriptionAvailable(): Promise<void> {
    if (!(await binaryExists(FFMPEG_BIN))) {
        throw new TranscriptionUnavailableError(
            `ffmpeg isn't available (looked for "${FFMPEG_BIN}"). Install it — on macOS: brew install ffmpeg — or set FFMPEG_BIN in apps/server/.env to its full path.`,
        );
    }
    if (!(await binaryExists(WHISPER_BIN))) {
        throw new TranscriptionUnavailableError(
            `whisper.cpp isn't available (looked for "${WHISPER_BIN}"). Install it — on macOS: brew install whisper-cpp — or set WHISPER_BIN in apps/server/.env to its full path.`,
        );
    }
    if (!WHISPER_MODEL) {
        throw new TranscriptionUnavailableError(
            "WHISPER_MODEL isn't set in apps/server/.env — point it at a downloaded whisper model file (for example ggml-base.bin from huggingface.co/ggerganov/whisper.cpp).",
        );
    }
    if (!fs.existsSync(WHISPER_MODEL)) {
        throw new TranscriptionUnavailableError(`The whisper model at WHISPER_MODEL (${WHISPER_MODEL}) doesn't exist.`);
    }
}

/**
 * Kicks the job off and returns immediately — the route answers 202 and
 * the row's transcript_status is what the UI follows from there.
 * Deliberately not awaited by the caller: transcribing an hour of video
 * takes minutes, far past any sensible request timeout.
 */
export function startTranscription(id: number, sourceVideoPath: string, language: string): void {
    running.add(id);
    markTranscriptProcessing(id);
    void transcribe(id, sourceVideoPath, language)
        .catch((e) => {
            // The catch inside transcribe() covers the expected failures;
            // this is the backstop for anything unforeseen, so that even
            // a bug leaves a visible failed row rather than a permanent
            // 'processing'.
            markTranscriptFailed(id, e instanceof Error ? e.message : "Transcription failed for an unknown reason.");
        })
        .finally(() => { running.delete(id); });
}

async function transcribe(id: number, sourceVideoPath: string, language: string): Promise<void> {
    fs.mkdirSync(audioDir, { recursive: true });
    fs.mkdirSync(transcriptDir, { recursive: true });

    const wavPath = path.join(audioDir, `${id}.wav`);
    // whisper.cpp appends the format's extension to -of, so this is the
    // stem: it writes <stem>.txt and <stem>.json.
    const outputStem = path.join(transcriptDir, String(id));
    const textPath = `${outputStem}.txt`;

    try {
        if (!fs.existsSync(sourceVideoPath)) {
            markTranscriptFailed(id, `No file at ${sourceVideoPath} — check the path, or point it somewhere the server can reach.`);
            return;
        }

        // 16 kHz mono PCM is what whisper.cpp expects; anything else it
        // either refuses or resamples worse than ffmpeg would.
        const extract = await runCommand(FFMPEG_BIN, [
            "-y", "-i", sourceVideoPath,
            "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
            wavPath,
        ]);
        if (extract.code !== 0) {
            markTranscriptFailed(id, `ffmpeg couldn't read that file (exit ${extract.code}). ${lastLines(extract.stderr)}`);
            return;
        }

        // -oj writes the timestamped segments the clip finder needs; -otxt
        // writes the plain transcript a person actually reads.
        // -l is not optional in practice: whisper.cpp's CLI defaults to
        // English, so a Czech recording without this is transcribed AS
        // English and comes back as plausible-looking nonsense — a
        // failure that reports success, which is exactly what the
        // transcript_status design exists to prevent. "auto" asks it to
        // detect instead of assuming.
        const whisper = await runCommand(WHISPER_BIN, [
            "-m", WHISPER_MODEL,
            "-f", wavPath,
            "-l", language || "auto",
            "-otxt", "-oj",
            "-of", outputStem,
        ]);
        if (whisper.code !== 0) {
            markTranscriptFailed(id, `whisper exited with ${whisper.code}. ${lastLines(whisper.stderr)}`);
            return;
        }

        if (!fs.existsSync(textPath)) {
            markTranscriptFailed(id, "whisper reported success but wrote no transcript file.");
            return;
        }
        // An empty transcript counts as a failure, not as a done row with
        // nothing in it — silent audio, the wrong track, a video with no
        // audio at all. Treating this as success is precisely the "it
        // looks like it worked" outcome to avoid.
        if (fs.readFileSync(textPath, "utf8").trim().length === 0) {
            markTranscriptFailed(id, "The transcript came out empty — the file may have no audible speech, or no audio track at all.");
            return;
        }

        // Whatever whisper detected is worth keeping: the generators
        // need to know which language to write the script and posts in,
        // and asking again later would mean re-running the whole job.
        const detected = readDetectedLanguage(id);
        if (detected) saveDetectedLanguage(id, detected);

        markTranscriptDone(id, textPath);
    } finally {
        // The WAV is a large intermediate and nothing reads it again.
        // The transcript and its JSON stay.
        fs.rmSync(wavPath, { force: true });
    }
}

/** Command output is long and the useful part is at the end. */
export function lastLines(stderr: string, count = 3): string {
    return stderr.trim().split("\n").slice(-count).join(" ").trim();
}

/** The language whisper reports in its JSON, or null if it didn't say. */
function readDetectedLanguage(id: number): string | null {
    const jsonPath = path.join(transcriptDir, `${id}.json`);
    if (!fs.existsSync(jsonPath)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as { result?: { language?: string } };
        const language = parsed.result?.language?.trim();
        return language ? language : null;
    } catch {
        return null;
    }
}

/**
 * The timestamped segments whisper wrote alongside the transcript.
 * Returns [] when the file is missing or unparseable — clip-finding
 * degrades to whole-transcript text rather than failing outright.
 */
export function readTranscriptSegments(id: number): { start: number; end: number; text: string }[] {
    const jsonPath = path.join(transcriptDir, `${id}.json`);
    if (!fs.existsSync(jsonPath)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
            transcription?: { offsets?: { from?: number; to?: number }; text?: string }[];
        };
        return (parsed.transcription ?? []).map((segment) => ({
            // whisper.cpp reports offsets in milliseconds.
            start: Math.round((segment.offsets?.from ?? 0) / 1000),
            end: Math.round((segment.offsets?.to ?? 0) / 1000),
            text: (segment.text ?? "").trim(),
        })).filter((segment) => segment.text.length > 0);
    } catch {
        return [];
    }
}

export function readTranscriptText(transcriptPath: string): string {
    try {
        return fs.readFileSync(transcriptPath, "utf8");
    } catch {
        return "";
    }
}
