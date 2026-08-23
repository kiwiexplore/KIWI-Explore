import fs from "node:fs";
import path from "node:path";
import { FFMPEG_BIN, runCommand } from "./videoTranscriber.js";
import type { ExportRequest } from "./videoExport.js";

/**
 * Handing the cut to DaVinci Resolve.
 *
 * The studio's own editor is for getting to a rough cut fast. Finishing
 * — grading, real audio work, anything a client will look at closely —
 * happens in Resolve, which is free and better at it than this will
 * ever be. So the useful thing is not to compete with it but to arrive
 * there with the cut already made.
 *
 * FCPXML rather than EDL or AAF. An EDL is one video track and no
 * audio; AAF is a binary format that would mean a dependency. FCPXML is
 * plain text, Resolve imports it directly, and it can carry several
 * tracks with the media relinked by absolute path — so nothing is
 * copied and nothing has to be found again by hand.
 *
 * Subtitles go out as a separate SRT rather than as FCPXML titles.
 * Titles need a reference to a generator effect that differs between
 * hosts and breaks quietly when it is wrong; an SRT is a text file
 * every editor on earth imports, and Resolve turns it into a subtitle
 * track in one step.
 */

/**
 * One timescale for every time in the file.
 *
 * 3000 divides evenly by 24, 25, 30, 50 and 60, so a whole number of
 * frames at any of those rates is a whole number here. Times that don't
 * land on a frame boundary are the usual reason an import arrives one
 * frame out and nobody can say why.
 */
const TIMESCALE = 3000;

function t(seconds: number): string {
    return `${Math.round(seconds * TIMESCALE)}/${TIMESCALE}s`;
}

/** XML text, with the five characters that aren't text. */
function xml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * A path as a URL, which is what media-rep wants.
 *
 * encodeURI leaves the slashes alone and escapes the spaces, and a
 * project folder called "KIWI Studio" has one in it — an unescaped
 * space is the difference between Resolve relinking the media and
 * showing you a timeline of red.
 */
function fileUrl(absolute: string): string {
    return `file://${encodeURI(absolute).replace(/#/g, "%23")}`;
}

/**
 * The real frame rate, from the file rather than from an assumption.
 *
 * Everything else here is exact, so guessing 25 and being handed 29.97
 * would put every cut after the first one progressively further out.
 * A file ffprobe can't read falls back to 25 and says so in a warning.
 */
async function probeFps(file: string): Promise<number | null> {
    // Read off ffmpeg's own stderr rather than asked of ffprobe:
    // ffprobe answers on STDOUT, which runCommand deliberately doesn't
    // capture — the same trap that made the drawtext probe wrong twice
    // in Sprint 098.
    const meta = await runCommand(FFMPEG_BIN, ["-hide_banner", "-i", file]).catch(() => null);
    const match = meta?.stderr.match(/,\s*([\d.]+)\s*fps/);
    const fps = match ? Number(match[1]) : NaN;
    return Number.isFinite(fps) && fps > 0 ? fps : null;
}

interface Asset {
    id: string;
    file: string;
    name: string;
    duration: number;
    hasAudio: boolean;
}

export interface ResolveResult {
    fcpxml: string;
    srt: string | null;
    warnings: string[];
}

/**
 * Builds the two files and puts them beside the footage.
 *
 * In the project's own folder rather than Exports/, because these are
 * not a render — they are the cut, and you open them from where the
 * material is.
 */
export async function writeResolveProject(
    title: string, request: ExportRequest, folder: string,
): Promise<ResolveResult> {
    const warnings: string[] = [];
    const media = request.clips.filter((c) => c.file);
    if (media.length === 0) throw new Error("There's nothing on the timeline to hand over.");

    // One asset per distinct file, because an FCPXML asset is the FILE
    // and a clip is a use of it. Emitting one per clip would make
    // Resolve think a file used three times is three files.
    const assets = new Map<string, Asset>();
    for (const clip of media) {
        if (assets.has(clip.file)) continue;
        const absolute = path.join(folder, clip.file);
        if (!fs.existsSync(absolute)) {
            warnings.push(`${clip.file} isn't in the project's folder any more — Resolve will ask you to relink it.`);
        }
        assets.set(clip.file, {
            id: `r${assets.size + 2}`,
            file: absolute,
            name: path.parse(clip.file).name,
            // The whole file, not the clip: an asset's duration is the
            // source's, and a clip's `start` indexes into it.
            duration: 0,
            hasAudio: true,
        });
    }

    const first = media.find((c) => c.kind === "video") ?? media[0];
    const fps = await probeFps(path.join(folder, first.file));
    if (fps === null) {
        warnings.push("Couldn't read the frame rate off the footage — the timeline is set to 25 fps, change it in Resolve if that's wrong.");
    }
    const rate = fps ?? 25;
    const frameDuration = `${Math.round(TIMESCALE / rate)}/${TIMESCALE}s`;

    // Source durations, so an asset isn't shorter than the clip using it.
    for (const asset of assets.values()) {
        const longest = media
            .filter((c) => path.join(folder, c.file) === asset.file)
            .reduce((n, c) => Math.max(n, c.offset + c.duration), 0);
        asset.duration = Math.max(longest, 1);
    }

    const total = request.clips.reduce((end, c) => Math.max(end, c.start + c.duration), 0);

    const video = media.filter((c) => c.kind === "video").sort((a, b) => a.start - b.start);
    const audio = media.filter((c) => c.kind === "audio").sort((a, b) => a.start - b.start);

    // The spine is one track and has to be continuous, so a hole
    // between two clips is a real element rather than an absence.
    const spine: string[] = [];
    let at = 0;
    for (const clip of video) {
        if (clip.start > at + 1 / TIMESCALE) {
            spine.push(`        <gap offset="${t(at)}" duration="${t(clip.start - at)}"/>`);
        }
        const asset = assets.get(clip.file);
        if (!asset) continue;
        spine.push(
            `        <asset-clip ref="${asset.id}" offset="${t(clip.start)}" name="${xml(asset.name)}"`
            + ` start="${t(clip.offset)}" duration="${t(clip.duration)}" format="r1" tcFormat="NDF"/>`,
        );
        at = Math.max(at, clip.start + clip.duration);
    }
    if (spine.length === 0) spine.push(`        <gap offset="0s" duration="${t(total)}"/>`);

    // Audio hangs off the spine on negative lanes, which is where
    // Resolve puts it — a positive lane would stack it over the picture.
    const connected: string[] = [];
    audio.forEach((clip, i) => {
        const asset = assets.get(clip.file);
        if (!asset) return;
        connected.push(
            `        <asset-clip ref="${asset.id}" lane="-${i + 1}" offset="${t(clip.start)}"`
            + ` name="${xml(asset.name)}" start="${t(clip.offset)}" duration="${t(clip.duration)}"`
            + ` audioRole="dialogue"/>`,
        );
    });

    const resources = [...assets.values()].map((a) =>
        `    <asset id="${a.id}" name="${xml(a.name)}" start="0s" duration="${t(a.duration)}"`
        + ` hasVideo="1" hasAudio="1" format="r1" audioSources="1" audioChannels="2">\n`
        + `      <media-rep kind="original-media" src="${xml(fileUrl(a.file))}"/>\n`
        + `    </asset>`).join("\n");

    const document = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="KIWIFormat" frameDuration="${frameDuration}" width="${request.width}" height="${request.height}" colorSpace="1-1-1 (Rec. 709)"/>
${resources}
  </resources>
  <library name="KIWI Studio">
    <event name="KIWI Studio">
      <project name="${xml(title)}">
        <sequence format="r1" duration="${t(total)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spine.join("\n")}
${connected.join("\n")}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;

    const stem = title.trim().replace(/[/\\:*?"<>|]/g, "-").slice(0, 80) || "KIWI cut";
    const fcpxmlPath = path.join(folder, `${stem}.fcpxml`);
    fs.writeFileSync(fcpxmlPath, document, "utf8");

    // Subtitles as their own file. Resolve imports an SRT onto a
    // subtitle track in one step, and it survives being opened by
    // anything else too.
    let srtPath: string | null = null;
    const texts = request.texts.filter((x) => x.text.trim());
    if (texts.length > 0) {
        const srt = texts
            .slice()
            .sort((a, b) => a.start - b.start)
            .map((x, i) => `${i + 1}\n${srtTime(x.start)} --> ${srtTime(x.start + x.duration)}\n${x.text.trim()}\n`)
            .join("\n");
        srtPath = path.join(folder, `${stem}.srt`);
        fs.writeFileSync(srtPath, srt, "utf8");
    }

    return { fcpxml: fcpxmlPath, srt: srtPath, warnings };
}

/** SRT wants hh:mm:ss,mmm — commas, not points. */
function srtTime(seconds: number): string {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const rest = ms % 1000;
    const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(rest, 3)}`;
}
