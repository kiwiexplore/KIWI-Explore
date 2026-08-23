import type { Clip, MediaAsset } from "../state/studioEditor";

/**
 * Taking the dead air out of a cut.
 *
 * ANALYZE VIDEO has been finding silence since Sprint 097 and doing
 * nothing about it. This is the same measurement, performed: the gaps
 * come out and everything after them moves left.
 *
 * Three things about it are decisions rather than details.
 *
 * A moment counts as silent only when EVERY clip covering it is quiet.
 * Music under a talking head is not dead air, and cutting the pause
 * would cut the music with it — so a bed on A2 correctly stops the
 * whole thing from finding anything, which is the right answer even
 * though it looks like a failure.
 *
 * The ripple crosses every track, subtitles included. Removing a range
 * from the picture and not from the sound is how an edit goes out of
 * sync, and it would happen on the very first cut.
 *
 * Padding is kept at both ends. Speech does not begin at full volume,
 * and a cut placed on the exact sample where the envelope crosses a
 * threshold clips the front of the word after it.
 */

export interface SilenceOptions {
    /** Peaks below this read as room tone rather than content. */
    floor: number;
    /** Only gaps at least this long are worth removing. */
    minRun: number;
    /** Left at each end of a gap, so words keep their attack. */
    pad: number;
}

export const DEFAULT_SILENCE: SilenceOptions = {
    // Matches ANALYZE VIDEO's own floor, so the two can never disagree
    // about what silence is.
    floor: 0.06,
    // Shorter than this is a breath, and an edit with the breaths taken
    // out sounds like a machine reading.
    minRun: 1.2,
    pad: 0.15,
};

export interface Range { start: number; end: number }

/** How finely the timeline is sampled when looking for quiet. */
const STEP = 0.05;

/**
 * Is anything audible at this moment?
 *
 * A clip with no decoded peaks counts as AUDIBLE rather than silent.
 * Peaks arrive after an import and can fail on a file the browser
 * can't decode; treating "we don't know" as silence would quietly
 * delete footage nobody had listened to.
 */
function audibleAt(time: number, clips: Clip[], assets: MediaAsset[], floor: number): boolean {
    for (const clip of clips) {
        if (clip.text !== undefined) continue;
        if (time < clip.start || time >= clip.start + clip.duration) continue;

        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset || asset.duration <= 0) return true;
        if (asset.peaks.length === 0) return true;

        const perPeak = asset.duration / asset.peaks.length;
        const index = Math.floor((clip.offset + (time - clip.start)) / perPeak);
        const peak = asset.peaks[Math.max(0, Math.min(asset.peaks.length - 1, index))];
        if (peak >= floor) return true;
    }
    return false;
}

/**
 * The stretches worth removing, in timeline time.
 *
 * A stretch with no clip over it at all counts as silent too — a hole
 * in the middle of an edit is dead air whether or not anybody put a
 * clip there to be quiet in.
 */
export function findSilence(
    clips: Clip[],
    assets: MediaAsset[],
    options: SilenceOptions = DEFAULT_SILENCE,
): Range[] {
    const media = clips.filter((c) => c.text === undefined);
    if (media.length === 0) return [];

    const total = clips.reduce((end, c) => Math.max(end, c.start + c.duration), 0);
    if (total <= 0) return [];

    const ranges: Range[] = [];
    let quietFrom: number | null = null;

    const close = (at: number) => {
        if (quietFrom === null) return;
        const start = quietFrom + options.pad;
        const end = at - options.pad;
        // Measured against the padded length, so `minRun` means what is
        // actually removed rather than what was found.
        if (end - start >= options.minRun) ranges.push({ start, end });
        quietFrom = null;
    };

    for (let t = 0; t < total; t += STEP) {
        if (audibleAt(t, media, assets, options.floor)) close(t);
        else if (quietFrom === null) quietFrom = t;
    }
    // A run still open at the end of the timeline is a real one — the
    // loop simply never sees the sample that would close it.
    close(total);

    return ranges;
}

const MIN_CLIP = 0.2;

/**
 * Cuts one range out of the timeline and closes the gap.
 *
 * A clip straddling the range is split; the far side keeps playing from
 * the right place in its source, which is the part that has to be got
 * right — moving a clip left without moving its offset would play the
 * wrong seconds of the file.
 */
function removeRange(clips: Clip[], range: Range): Clip[] {
    const { start: a, end: b } = range;
    const length = b - a;
    const out: Clip[] = [];

    for (const clip of clips) {
        const s = clip.start;
        const end = s + clip.duration;

        if (end <= a) { out.push(clip); continue; }
        if (s >= b) { out.push({ ...clip, start: s - length }); continue; }

        // The part before the cut keeps its own start and offset.
        if (s < a) {
            const duration = Math.min(end, a) - s;
            if (duration >= MIN_CLIP) out.push({ ...clip, duration });
        }
        // The part after it lands where the cut began, and starts that
        // much further into the source.
        if (end > b) {
            const from = Math.max(s, b);
            const duration = end - from;
            if (duration >= MIN_CLIP) {
                out.push({
                    ...clip,
                    id: `${clip.id}-x${Math.round(a * 100)}`,
                    start: a,
                    offset: clip.offset + (from - s),
                    duration,
                });
            }
        }
    }
    return out;
}

export interface SilenceCut {
    clips: Clip[];
    /** How many gaps came out. */
    gaps: number;
    /** How much time, in seconds. */
    removed: number;
}

/**
 * Applies every range at once, back to front.
 *
 * Back to front because each removal shifts everything after it: taken
 * in that order, the ranges still to be applied are all before the one
 * being applied and their coordinates are untouched.
 */
export function cutSilence(
    clips: Clip[],
    assets: MediaAsset[],
    options: SilenceOptions = DEFAULT_SILENCE,
): SilenceCut {
    const ranges = findSilence(clips, assets, options);
    let next = clips;
    for (let i = ranges.length - 1; i >= 0; i -= 1) next = removeRange(next, ranges[i]);
    return {
        clips: next,
        gaps: ranges.length,
        removed: ranges.reduce((n, r) => n + (r.end - r.start), 0),
    };
}
