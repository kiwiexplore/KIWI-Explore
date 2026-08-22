import { useCallback, useRef, useState } from "react";
import { extractFrames, extractPeaks } from "../lib/mediaPreview";

/**
 * The editor's own model: media you imported, tracks, and the clips on
 * them.
 *
 * Deliberately NOT server-backed yet. An imported file lives as an
 * object URL for the session — the browser cannot read a path off the
 * disk, and uploading gigabytes of raw footage to a backend running on
 * the same machine would be work for its own sake. What this owns is
 * the shape of an edit; where those bytes eventually come from is a
 * separate question (see Video Studio's own source_video_path, which
 * the server already reads directly).
 *
 * Everything here is measured in SECONDS. Pixels belong to the timeline
 * component and are derived from a zoom factor; keeping the model in
 * time means zooming can never move a cut.
 */

export type MediaKind = "video" | "audio" | "image";

export interface MediaAsset {
    id: string;
    name: string;
    kind: MediaKind;
    /** Object URL for the session. Revoked when the asset is removed. */
    url: string;
    /** Seconds, once the browser has read the file's metadata. */
    duration: number;
    width: number;
    height: number;
    /**
     * Filmstrip frames and the audio envelope, filled in after the
     * import returns. Both are slow enough to be worth not waiting for
     * — the asset is usable the moment its metadata is read, and the
     * timeline simply draws a plain block until these arrive.
     */
    frames: string[];
    peaks: number[];
    /** Kept so an export can send the bytes to the server. */
    file: File;
    /** The server's id for it, once uploaded. */
    serverFile?: string;
}

export type TrackKind = "video" | "audio";

export interface Track {
    id: string;
    label: string;
    kind: TrackKind;
}

export interface Clip {
    id: string;
    trackId: string;
    /**
     * Empty for a text clip. Text and media are one type rather than
     * two lists because everything the timeline does to a clip — move,
     * trim, split, delete, snap, undo — is identical for both, and a
     * parallel list would mean writing all of it twice.
     */
    assetId: string;
    /** Set on a text clip; what gets drawn over the picture. */
    text?: string;
    /** Where the clip sits on the timeline. */
    start: number;
    /** How long it plays for. */
    duration: number;
    /** Where playback starts INSIDE the source — what trimming moves. */
    offset: number;
}

/** V1 on top, A3 at the bottom, matching how the timeline reads. */
export const DEFAULT_TRACKS: Track[] = [
    { id: "V1", label: "V1", kind: "video" },
    { id: "V2", label: "V2", kind: "video" },
    { id: "V3", label: "V3", kind: "video" },
    { id: "A1", label: "A1", kind: "audio" },
    { id: "A2", label: "A2", kind: "audio" },
    { id: "A3", label: "A3", kind: "audio" },
];

export interface StudioEditorState {
    assets: MediaAsset[];
    tracks: Track[];
    clips: Clip[];
    selectedClipId: string | null;
    /** Seconds. The playhead — what the preview is showing. */
    playhead: number;
    playing: boolean;
    /** Where the last clip ends. The project's own length. */
    duration: number;

    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    /**
     * Called once at the start of a drag. A pointer gesture changes the
     * edit on every frame; without this, one drag across the timeline
     * would fill the history with a hundred indistinguishable steps and
     * undo would become a slow rewind rather than a way back.
     */
    beginGesture: () => void;

    importFiles: (files: FileList | File[]) => Promise<void>;
    removeAsset: (id: string) => void;
    /** Records that an asset now exists on the server. */
    setServerFile: (id: string, serverFile: string) => void;
    addClip: (assetId: string, trackId?: string, start?: number) => void;
    selectClip: (id: string | null) => void;
    moveClip: (id: string, start: number, snap?: boolean) => void;
    /** Edges other clips and the playhead sit on, for snapping. */
    snapPoints: (exceptClipId?: string) => number[];
    trimClip: (id: string, edge: "start" | "end", delta: number) => void;
    splitAt: (time: number) => void;
    addText: (text: string, start: number, duration: number, trackId?: string) => void;
    /** Replaces every text clip on the subtitle track. */
    setSubtitles: (segments: { start: number; end: number; text: string }[]) => void;
    updateText: (id: string, text: string) => void;
    /** Text clips covering this moment, topmost track last. */
    textAt: (time: number) => Clip[];
    deleteSelected: () => void;
    setPlayhead: (time: number) => void;
    setPlaying: (playing: boolean) => void;

    /** Which clip covers the playhead on the topmost video track. */
    clipAt: (time: number) => { clip: Clip; asset: MediaAsset } | null;
}

const MIN_CLIP = 0.2;

/** Far more than anyone reaches for, and cheap: a snapshot is a list. */
const HISTORY_LIMIT = 60;

function kindOf(file: File): MediaKind | null {
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("image/")) return "image";
    return null;
}

/**
 * Reads duration and dimensions by letting the browser load the file's
 * metadata. An image has no duration, so it gets a default length the
 * way every editor gives stills one.
 */
function readMetadata(url: string, kind: MediaKind): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve) => {
        if (kind === "image") {
            const img = new Image();
            img.onload = () => resolve({ duration: 5, width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ duration: 5, width: 0, height: 0 });
            img.src = url;
            return;
        }
        const el = document.createElement(kind === "video" ? "video" : "audio");
        el.preload = "metadata";
        el.onloadedmetadata = () => {
            const v = el as HTMLVideoElement;
            resolve({
                duration: Number.isFinite(el.duration) ? el.duration : 0,
                width: v.videoWidth ?? 0,
                height: v.videoHeight ?? 0,
            });
        };
        // A file the browser can't decode still belongs in the bin — it
        // just can't say how long it is.
        el.onerror = () => resolve({ duration: 0, width: 0, height: 0 });
        el.src = url;
    });
}

export function useStudioEditorState(): StudioEditorState {
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    // Clips and their history are ONE piece of state, changed in one
    // atomic update.
    //
    // They were three separate useStates, and two actions in the same
    // tick both snapshotted the same stale list — so adding two clips
    // recorded "empty" twice and a single undo threw away both. Reading
    // the previous edit inside the updater is the only way to be sure
    // what is being recorded is what is actually there.
    //
    // Whole-list snapshots rather than a log of inverse operations:
    // clips are small and few, and storing what the edit WAS is exact
    // by construction, where replaying inverses has to be kept correct
    // as every new operation is added.
    const [edit, setEdit] = useState<{ clips: Clip[]; history: Clip[][]; future: Clip[][] }>({
        clips: [], history: [], future: [],
    });
    const clips = edit.clips;
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [playhead, setPlayheadState] = useState(0);
    const [playing, setPlaying] = useState(false);
    const nextId = useRef(1);

    const makeId = (prefix: string) => `${prefix}-${nextId.current++}`;

    const duration = clips.reduce((end, c) => Math.max(end, c.start + c.duration), 0);

    const importFiles = useCallback(async (files: FileList | File[]) => {
        const list = Array.from(files);
        const imported: MediaAsset[] = [];
        for (const file of list) {
            const kind = kindOf(file);
            if (!kind) continue;
            const url = URL.createObjectURL(file);
            const meta = await readMetadata(url, kind);
            imported.push({
                id: `asset-${nextId.current++}`,
                name: file.name,
                kind,
                url,
                duration: meta.duration,
                width: meta.width,
                height: meta.height,
                frames: [],
                peaks: [],
                file,
            });
        }
        if (imported.length === 0) return;
        setAssets((prev) => [...prev, ...imported]);

        // Frames and peaks land as they finish, one asset at a time, so
        // importing five files doesn't decode five videos at once.
        for (const asset of imported) {
            if (asset.kind === "video") {
                void extractFrames(asset.url, asset.duration).then((frames) => {
                    if (frames.length) setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, frames } : a)));
                });
            }
            if (asset.kind !== "image") {
                void extractPeaks(asset.url).then((peaks) => {
                    if (peaks.length) setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, peaks } : a)));
                });
            }
        }
    }, []);

    /** Records the edit as it stands, then changes it. */
    const commit = (next: (prev: Clip[]) => Clip[]) => setEdit((e) => ({
        clips: next(e.clips),
        history: [...e.history, e.clips].slice(-HISTORY_LIMIT),
        future: [],
    }));

    /** Changes the edit without recording — inside a gesture already
     *  bracketed by beginGesture(). */
    const applyLive = (next: (prev: Clip[]) => Clip[]) => setEdit((e) => ({ ...e, clips: next(e.clips) }));

    const beginGesture = () => setEdit((e) => ({
        ...e,
        history: [...e.history, e.clips].slice(-HISTORY_LIMIT),
        future: [],
    }));

    const undo = () => {
        setEdit((e) => (e.history.length === 0 ? e : {
            clips: e.history[e.history.length - 1],
            history: e.history.slice(0, -1),
            future: [e.clips, ...e.future].slice(0, HISTORY_LIMIT),
        }));
        // The clip that was selected may not exist in the restored edit.
        setSelectedClipId(null);
    };

    const redo = () => {
        setEdit((e) => (e.future.length === 0 ? e : {
            clips: e.future[0],
            history: [...e.history, e.clips].slice(-HISTORY_LIMIT),
            future: e.future.slice(1),
        }));
        setSelectedClipId(null);
    };

    const setServerFile = (id: string, serverFile: string) =>
        setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, serverFile } : a)));

    const removeAsset = (id: string) => {
        setAssets((prev) => {
            const gone = prev.find((a) => a.id === id);
            // Object URLs are a real allocation — dropping the reference
            // without revoking keeps the file alive for the session.
            if (gone) URL.revokeObjectURL(gone.url);
            return prev.filter((a) => a.id !== id);
        });
        commit((prev) => prev.filter((c) => c.assetId !== id));
    };

    /**
     * Lands at `start` when dropped somewhere specific, otherwise after
     * whatever is already on the track — which is what the Add button
     * means.
     */
    const addClip = (assetId: string, trackId?: string, start?: number) => {
        const asset = assets.find((a) => a.id === assetId);
        if (!asset) return;
        const track = trackId ?? (asset.kind === "audio" ? "A1" : "V1");
        commit((prev) => {
            const end = prev.filter((c) => c.trackId === track)
                .reduce((max, c) => Math.max(max, c.start + c.duration), 0);
            const clip: Clip = {
                id: makeId("clip"),
                trackId: track,
                assetId,
                start: start !== undefined ? Math.max(0, start) : end,
                duration: asset.duration || 5,
                offset: 0,
            };
            return [...prev, clip];
        });
    };

    /** Zero and the playhead are always worth snapping to, plus every
     *  other clip's two edges — that's what makes cuts land flush
     *  without demanding pixel accuracy from a trackpad. */
    const snapPoints = (exceptClipId?: string): number[] => {
        const points = [0, playhead];
        for (const c of clips) {
            if (c.id === exceptClipId) continue;
            points.push(c.start, c.start + c.duration);
        }
        return points;
    };

    const moveClip = (id: string, start: number) => {
        applyLive((prev) => prev.map((c) => (c.id === id ? { ...c, start: Math.max(0, start) } : c)));
    };

    /**
     * Dragging the left edge moves BOTH where the clip sits and where it
     * starts inside the source — otherwise trimming the head would slide
     * the footage rather than shorten the clip.
     */
    const trimClip = (id: string, edge: "start" | "end", delta: number) => {
        applyLive((prev) => prev.map((c) => {
            if (c.id !== id) return c;
            if (edge === "end") {
                return { ...c, duration: Math.max(MIN_CLIP, c.duration + delta) };
            }
            const shift = Math.min(delta, c.duration - MIN_CLIP);
            const start = Math.max(0, c.start + shift);
            const moved = start - c.start;
            return { ...c, start, offset: Math.max(0, c.offset + moved), duration: c.duration - moved };
        }));
    };

    /** Cuts every clip the playhead is standing on, on every track. */
    /** V3 is the titles track in every layout this thing has had. */
    const TEXT_TRACK = "V3";

    const addText = (text: string, start: number, duration: number, trackId = TEXT_TRACK) => {
        commit((prev) => [...prev, {
            id: makeId("text"),
            trackId,
            assetId: "",
            text,
            start: Math.max(0, start),
            duration: Math.max(MIN_CLIP, duration),
            offset: 0,
        }]);
    };

    /**
     * Replaces rather than appends: importing subtitles twice should
     * leave one set, not two stacked on top of each other.
     */
    const setSubtitles = (segments: { start: number; end: number; text: string }[]) => {
        commit((prev) => [
            ...prev.filter((c) => !(c.trackId === TEXT_TRACK && c.text !== undefined)),
            ...segments
                .filter((s) => s.text.trim() && s.end > s.start)
                .map((s, i) => ({
                    id: `sub-${i + 1}-${Date.now()}`,
                    trackId: TEXT_TRACK,
                    assetId: "",
                    text: s.text.trim(),
                    start: s.start,
                    duration: Math.max(MIN_CLIP, s.end - s.start),
                    offset: 0,
                })),
        ]);
    };

    const updateText = (id: string, text: string) => {
        commit((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
    };

    const textAt = (time: number): Clip[] =>
        clips.filter((c) => c.text !== undefined && time >= c.start && time < c.start + c.duration);

    const splitAt = (time: number) => {
        commit((prev) => {
            const out: Clip[] = [];
            for (const c of prev) {
                const local = time - c.start;
                if (local > MIN_CLIP && local < c.duration - MIN_CLIP) {
                    out.push({ ...c, duration: local });
                    out.push({
                        ...c,
                        id: makeId("clip"),
                        start: time,
                        duration: c.duration - local,
                        offset: c.offset + local,
                    });
                } else {
                    out.push(c);
                }
            }
            return out;
        });
    };

    const deleteSelected = () => {
        if (!selectedClipId) return;
        commit((prev) => prev.filter((c) => c.id !== selectedClipId));
        setSelectedClipId(null);
    };

    const setPlayhead = (time: number) => setPlayheadState(Math.max(0, time));

    /**
     * The topmost video track wins, the way it does in every editor —
     * V1 is the base and anything above it covers.
     */
    const clipAt = (time: number) => {
        for (const track of DEFAULT_TRACKS.filter((t) => t.kind === "video").slice().reverse()) {
            const clip = clips.find((c) => c.trackId === track.id && c.text === undefined
                && time >= c.start && time < c.start + c.duration);
            if (clip) {
                const asset = assets.find((a) => a.id === clip.assetId);
                if (asset) return { clip, asset };
            }
        }
        return null;
    };

    return {
        assets, tracks: DEFAULT_TRACKS, clips, selectedClipId, playhead, playing, duration,
        canUndo: edit.history.length > 0,
        canRedo: edit.future.length > 0,
        undo, redo, beginGesture,
        importFiles, removeAsset, setServerFile, addClip,
        selectClip: setSelectedClipId,
        moveClip, trimClip, splitAt, deleteSelected,
        addText, setSubtitles, updateText, textAt,
        setPlayhead, setPlaying,
        snapPoints,
        clipAt,
    };
}
