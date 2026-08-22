/**
 * Turning an imported file into something the timeline can draw:
 * filmstrip frames for video, a peak envelope for audio.
 *
 * Both run in the browser off the same object URL the preview plays, so
 * nothing is uploaded and nothing is decoded twice. Both are also
 * best-effort: a file the browser can't decode still belongs in the bin
 * and on the timeline — it just draws as a plain block, which is what
 * the empty returns here mean.
 */

/** How many frames a clip's filmstrip carries. Enough to read motion. */
const FRAME_COUNT = 8;
const FRAME_WIDTH = 96;

/**
 * Grabs evenly-spaced frames by seeking a detached <video> and painting
 * each onto a canvas.
 *
 * Seeks are serialised on purpose: a browser coalesces overlapping
 * seeks on one element, so firing them in parallel returns the same
 * frame several times rather than the strip you asked for.
 */
export async function extractFrames(url: string, duration: number): Promise<string[]> {
    if (!(duration > 0)) return [];

    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    // Same-origin object URLs don't taint the canvas, but saying so
    // keeps this working if the source ever becomes a real URL.
    video.crossOrigin = "anonymous";

    const ready = await new Promise<boolean>((resolve) => {
        video.onloadeddata = () => resolve(true);
        video.onerror = () => resolve(false);
    });
    if (!ready || !video.videoWidth) return [];

    const canvas = document.createElement("canvas");
    canvas.width = FRAME_WIDTH;
    canvas.height = Math.max(1, Math.round(FRAME_WIDTH * (video.videoHeight / video.videoWidth)));
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const frames: string[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
        // Sampled from the middle of each slice rather than its edge —
        // the very first and last frames of a shot are often black.
        const at = duration * ((i + 0.5) / FRAME_COUNT);
        const seeked = await new Promise<boolean>((resolve) => {
            const done = () => { video.onseeked = null; resolve(true); };
            video.onseeked = done;
            video.onerror = () => resolve(false);
            try { video.currentTime = Math.min(at, Math.max(0, duration - 0.05)); }
            catch { resolve(false); }
        });
        if (!seeked) break;
        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.6));
        } catch {
            break;
        }
    }

    video.src = "";
    return frames;
}

/** How many peak buckets an envelope carries, whatever the length. */
const PEAK_COUNT = 400;

/**
 * The loudest sample in each of PEAK_COUNT slices, normalised to 0..1.
 *
 * Peaks rather than an average: an average envelope of speech is a flat
 * sausage, while peaks show where the words actually are — which is the
 * only reason to look at a waveform on a timeline.
 */
export async function extractPeaks(url: string): Promise<number[]> {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return [];

    let ctx: AudioContext | null = null;
    try {
        const res = await fetch(url);
        const bytes = await res.arrayBuffer();
        ctx = new Ctor();
        const audio = await ctx.decodeAudioData(bytes);
        const data = audio.getChannelData(0);
        const per = Math.max(1, Math.floor(data.length / PEAK_COUNT));

        const peaks: number[] = [];
        let loudest = 0;
        for (let i = 0; i < PEAK_COUNT; i++) {
            let peak = 0;
            const from = i * per;
            for (let j = from; j < from + per && j < data.length; j++) {
                const v = Math.abs(data[j]);
                if (v > peak) peak = v;
            }
            peaks.push(peak);
            if (peak > loudest) loudest = peak;
        }
        // Normalising to the file's own loudest point means a quietly
        // recorded take still reads, instead of drawing as a flat line.
        return loudest > 0 ? peaks.map((p) => p / loudest) : peaks;
    } catch {
        // A video with no audio track lands here, which is not an error.
        return [];
    } finally {
        void ctx?.close();
    }
}
