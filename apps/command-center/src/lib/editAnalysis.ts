import type { Clip, MediaAsset } from "../state/studioEditor";

/**
 * What KIWI notices about a cut.
 *
 * Every finding here is measured from the edit and the decoded audio
 * that are already in the browser — clip lengths, the peak envelope,
 * where the first picture starts. Nothing is inferred, nothing is
 * asked of a model, and nothing is invented: an observation that can't
 * be measured isn't made.
 *
 * That matters more than it sounds. A suggestion carrying a real
 * timecode can be checked in two seconds by dragging the playhead
 * there; one that can't is just an opinion with a number attached.
 */

export type FindingKind = "pacing" | "silence" | "loud" | "intro" | "highlight";

export interface Finding {
    id: string;
    kind: FindingKind;
    start: number;
    end: number;
    /** What was noticed, in one sentence. */
    text: string;
}

/** Longer than this and a static shot starts to drag. */
const LONG_SHOT = 9;
/** Peaks below this read as room tone rather than content. */
const SILENT = 0.06;
/** A gap worth mentioning; shorter ones are just breathing. */
const SILENCE_RUN = 1.5;
/** Peaks above this are close to clipping. */
const HOT = 0.97;
/**
 * A hot stretch has to last this long to be worth reporting. Without
 * it, a single bucket at the head of an encode — where codecs
 * routinely leave a transient — produced a finding spanning zero
 * seconds, which reads as broken rather than as a warning.
 */
const HOT_RUN = 0.4;

function clock(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

/**
 * Walks the peak envelope of every clip, in timeline time, and reports
 * runs that stay under or over a threshold.
 *
 * The peaks belong to the SOURCE, so each clip's own slice is taken
 * (offset to offset+duration) and mapped back onto where that clip sits
 * — otherwise a trimmed clip would report silence from a part of the
 * file it no longer plays.
 */
function scanAudio(clips: Clip[], assets: MediaAsset[]): Finding[] {
    const findings: Finding[] = [];

    for (const clip of clips) {
        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset || asset.peaks.length === 0 || asset.duration <= 0) continue;

        const perPeak = asset.duration / asset.peaks.length;
        const from = Math.floor(clip.offset / perPeak);
        const to = Math.min(asset.peaks.length, Math.ceil((clip.offset + clip.duration) / perPeak));

        let quietFrom: number | null = null;
        let hotFrom: number | null = null;

        const closeQuiet = (at: number) => {
            if (quietFrom !== null && at - quietFrom >= SILENCE_RUN) {
                findings.push({
                    id: `silence-${clip.id}-${Math.round(quietFrom)}`,
                    kind: "silence",
                    start: quietFrom,
                    end: at,
                    text: `${(at - quietFrom).toFixed(1)} s of near-silence from ${clock(quietFrom)}.`,
                });
            }
            quietFrom = null;
        };

        const closeHot = (at: number) => {
            if (hotFrom !== null && at - hotFrom >= HOT_RUN) {
                findings.push({
                    id: `loud-${clip.id}-${Math.round(hotFrom)}`,
                    kind: "loud",
                    start: hotFrom,
                    end: at,
                    text: `Audio is close to clipping from ${clock(hotFrom)} to ${clock(at)}.`,
                });
            }
            hotFrom = null;
        };

        for (let i = from; i < to; i++) {
            const at = clip.start + (i - from) * perPeak;
            const peak = asset.peaks[i];

            if (peak < SILENT) {
                if (quietFrom === null) quietFrom = at;
            } else {
                closeQuiet(at);
            }

            if (peak > HOT) {
                if (hotFrom === null) hotFrom = at;
            } else {
                closeHot(at);
            }
        }

        // A run still open when the clip ends is a real finding — the
        // loop simply never sees the value that would close it.
        closeQuiet(clip.start + clip.duration);
        closeHot(clip.start + clip.duration);
    }
    return findings;
}

export function analyseEdit(clips: Clip[], assets: MediaAsset[]): Finding[] {
    const media = clips.filter((c) => c.text === undefined).slice().sort((a, b) => a.start - b.start);
    if (media.length === 0) return [];

    const findings: Finding[] = [];

    // How long before the picture starts. Everybody's own intro is the
    // last thing they cut, and the number is usually a surprise.
    const first = media[0];
    if (first.start > 3) {
        findings.push({
            id: "intro",
            kind: "intro",
            start: 0,
            end: first.start,
            text: `${first.start.toFixed(1)} s pass before the first shot appears.`,
        });
    }

    for (const clip of media) {
        if (clip.duration > LONG_SHOT) {
            findings.push({
                id: `pacing-${clip.id}`,
                kind: "pacing",
                start: clip.start,
                end: clip.start + clip.duration,
                text: `This shot runs ${clip.duration.toFixed(1)} s. Cutting it to 6–7 s would keep the pace around it.`,
            });
        }
    }

    findings.push(...scanAudio(media, assets));

    // The loudest sustained stretch tends to be where something actually
    // happens — the nearest thing to a highlight that can be measured
    // rather than guessed at.
    let best: { at: number; energy: number } | null = null;
    for (const clip of media) {
        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset || asset.peaks.length === 0 || asset.duration <= 0) continue;
        const perPeak = asset.duration / asset.peaks.length;
        const window = Math.max(1, Math.round(4 / perPeak));
        const from = Math.floor(clip.offset / perPeak);
        const to = Math.min(asset.peaks.length, Math.ceil((clip.offset + clip.duration) / perPeak));
        for (let i = from; i + window < to; i++) {
            let energy = 0;
            for (let j = i; j < i + window; j++) energy += asset.peaks[j];
            energy /= window;
            if (!best || energy > best.energy) best = { at: clip.start + (i - from) * perPeak, energy };
        }
    }
    if (best && best.energy > 0.3) {
        findings.push({
            id: "highlight",
            kind: "highlight",
            start: best.at,
            end: best.at + 4,
            text: `The busiest four seconds start at ${clock(best.at)} — worth a look as a Short.`,
        });
    }

    return findings.sort((a, b) => a.start - b.start);
}
