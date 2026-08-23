import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
    Captions, ChevronLeft, Clapperboard, Film, Music2, Redo2, Scissors, SkipBack, SkipForward,
    Sparkles, Trash2, Type, Undo2, Upload, Volume2, ZoomIn, ZoomOut,
} from "lucide-react";
import { useStudioEditorState, type Clip } from "../../state/studioEditor";
import {
    exportFileUrl, exportTimeline, fetchTranscript, fetchVideoProject, saveTimeline,
    saveTimelineOnUnload, sendToResolve, startTranscription, VideoStepBlockedError, VIDEO_LANGUAGES,
    EXPORT_PRESETS, type VideoProject,
} from "../../lib/videoApi";
import { assetsFromFolder } from "../../lib/projectMedia";
import type { StudioProject } from "../../lib/projectsApi";
import { analyseEdit, type Finding } from "../../lib/editAnalysis";
import { cutSilence, findSilence } from "../../lib/silenceCut";
import { renderCaption } from "../../lib/captionImage";
import { canPickFolder, saveRenderAs } from "../../lib/saveAs";
import StudioTimeline from "./StudioTimeline";
import { formatClock } from "../../lib/timecode";
import "./StudioEditor.css";

const ZOOM_STEPS = [2, 4, 8, 16, 32, 64];

/**
 * How long the edit has to sit still before it is written.
 *
 * Long enough that dragging a clip is one save rather than a hundred,
 * short enough that it is over before you have finished thinking about
 * the next cut.
 */
const SAVE_AFTER = 900;

/**
 * Only what cannot be worked out from the edit itself. Whether there
 * are unsaved changes is a comparison, not a flag — a flag would be a
 * second copy of that fact, free to disagree with the first.
 */
type SaveState = "idle" | "saving" | "failed";

/**
 * Where the subtitle flow is.
 *
 * "picking" is not an error state. A video with no transcript yet is
 * the ordinary case, and the editor already knows both things the job
 * needs — which file is under the playhead and what the video is spoken
 * in — so it offers to run it rather than reporting that it can't.
 */
type SubtitleStage = "closed" | "picking" | "transcribing";

/** How often the row is re-read while whisper runs. Same three seconds
 *  Video Studio's own poll uses, and for the same reason: the job
 *  finishes in the server process with nothing to push. */
const TRANSCRIPT_POLL = 3000;

/** The saved cut, or an empty one. A stored shape that isn't a list of
 *  clips is treated as nothing saved rather than trusted. */
function storedClips(timeline: unknown): Clip[] {
    const stored = timeline as { clips?: unknown } | null;
    return stored && Array.isArray(stored.clips) ? (stored.clips as Clip[]) : [];
}

interface StudioEditorProps {
    project: VideoProject;
    /** The project whose folder the media comes from. */
    owner: StudioProject | null;
    onBack: () => void;
}

/**
 * The cut, full width: media on the left, the picture in the middle,
 * KIWI on the right, the timeline across the bottom.
 *
 * The preview is a real <video> driven by the timeline rather than a
 * player with its own opinion: whichever clip covers the playhead is
 * mounted, seeked to that clip's own offset, and played. That is what
 * makes the middle of the screen show the EDIT instead of showing one
 * imported file.
 *
 * KIWI's column suggests and never touches the timeline. That is the
 * line the whole thing is built on, and it is written into the panel so
 * it can't quietly erode.
 */
export default function StudioEditor({ project, owner, onBack }: StudioEditorProps) {
    // The saved cut is where the editor STARTS. Keyed on the video in
    // Laboratory, so opening another one is a new editor with that
    // video's cut already in it.
    const editor = useStudioEditorState(storedClips(project.timeline));
    const videoRef = useRef<HTMLVideoElement>(null);
    const [zoom, setZoom] = useState(2);
    const [volume, setVolume] = useState(1);
    const rootRef = useRef<HTMLDivElement>(null);
    const [subtitleError, setSubtitleError] = useState<string | null>(null);
    const [loadingSubs, setLoadingSubs] = useState(false);
    // Already running when the editor opened — the job outlives the
    // screen it was started from.
    const [subs, setSubs] = useState<SubtitleStage>(
        project.transcriptStatus === "processing" ? "transcribing" : "closed",
    );
    const [subFile, setSubFile] = useState("");
    const [subLanguage, setSubLanguage] = useState(project.language);
    const [findings, setFindings] = useState<Finding[] | null>(null);
    const [cutReport, setCutReport] = useState<string | null>(null);
    const [exporting, setExporting] = useState<string | null>(null);
    const [exportDone, setExportDone] = useState<{ variant: string; label: string; bytes: number; warnings: string[] }[] | null>(null);
    const [savedTo, setSavedTo] = useState<string | null>(null);
    // Which shapes to render. The native one on its own by default —
    // a vertical cut is a deliberate act, not something to produce
    // every time on the chance somebody wants one.
    const [shapes, setShapes] = useState<string[]>([""]);
    const [exportError, setExportError] = useState<string | null>(null);
    const [resolveDone, setResolveDone] = useState<{ fcpxml: string; srt: string | null; warnings: string[] } | null>(null);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [retry, setRetry] = useState(0);

    // Focus the editor on open so the shortcuts work without demanding
    // a click somewhere first.
    useEffect(() => { rootRef.current?.focus(); }, []);

    // The bin IS the project's folder. Nothing is imported into the app
    // — the files are already where they belong, and this reads them.
    const { setAssets } = editor;
    useEffect(() => {
        if (!owner) return;
        let cancelled = false;
        void assetsFromFolder(owner.id, owner.files).then((assets) => {
            if (!cancelled) setAssets(assets);
        });
        return () => { cancelled = true; };
    }, [owner, setAssets]);

    /**
     * Every change to the edit is written, not just the ones somebody
     * remembered to press Save after.
     *
     * Undo is what made this necessary: a cut you took back was still
     * on the server, and one you took back and then improved was not.
     * The button was a promise the editor could not keep.
     *
     * What counts as a change is a comparison against what the server
     * is known to hold, not against the previous render. Undo hands
     * back an OLD array, so anything watching identity would either
     * save on every render or decide an undone edit wasn't a change.
     */
    /**
     * What the server is known to hold, as JSON. State rather than a
     * ref because "is there anything unsaved" is read while rendering
     * the bar — a ref would let the read-out go on saying Unsaved after
     * the save landed.
     */
    const [savedJson, setSavedJson] = useState(() => JSON.stringify(storedClips(project.timeline)));
    /** What it does not hold yet — read by the flush on the way out. */
    const unsaved = useRef<string | null>(null);

    const clipsJson = useMemo(() => JSON.stringify(editor.clips), [editor.clips]);
    const dirty = clipsJson !== savedJson;

    useEffect(() => {
        if (!dirty) return;
        unsaved.current = clipsJson;
        const clips = editor.clips;
        // Nothing is written until the edit has sat still: dragging a
        // clip changes it on every frame, and a save per frame would be
        // a hundred writes describing one gesture.
        const timer = setTimeout(() => {
            setSaveState("saving");
            void saveTimeline(project.id, { clips })
                .then(() => {
                    setSavedJson(clipsJson);
                    // An edit made while this was in flight has already
                    // claimed `unsaved`; clearing it would lose that
                    // newer one on the way out.
                    if (unsaved.current === clipsJson) unsaved.current = null;
                    setSaveState("idle");
                })
                .catch(() => setSaveState("failed"));
        }, SAVE_AFTER);
        return () => clearTimeout(timer);
    }, [dirty, clipsJson, editor.clips, project.id, retry]);

    /**
     * Leaving — the button, or the window — must not throw away a cut
     * that was still inside the debounce window. Declared after the
     * effect above so its cleanup runs second: the pending timer is
     * cancelled first, and then what it was going to save is sent.
     */
    useEffect(() => {
        const flush = () => {
            if (!unsaved.current) return;
            saveTimelineOnUnload(project.id, { clips: JSON.parse(unsaved.current) as Clip[] });
            unsaved.current = null;
        };
        window.addEventListener("pagehide", flush);
        return () => { window.removeEventListener("pagehide", flush); flush(); };
    }, [project.id]);

    const pxPerSecond = ZOOM_STEPS[zoom];
    const current = editor.clipAt(editor.playhead);
    const selectedText = editor.clips.find((c) => c.id === editor.selectedClipId && c.text !== undefined) ?? null;

    // The playhead is the clock. While playing, it advances from the
    // mounted clip's own currentTime rather than from a timer, so the
    // ruler can never drift away from the picture.
    useEffect(() => {
        const el = videoRef.current;
        if (!el || !current) return;
        const wanted = current.clip.offset + (editor.playhead - current.clip.start);
        if (Math.abs(el.currentTime - wanted) > 0.25) el.currentTime = wanted;
    }, [current, editor.playhead]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        if (editor.playing) void el.play().catch(() => editor.setPlaying(false));
        else el.pause();
        // Only the two things that should start or stop playback are
        // listed. `editor` is rebuilt every render, so depending on it
        // would re-run this on every playhead tick — which is to say,
        // continuously, while playing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor.playing, current?.asset.url]);

    useEffect(() => {
        const el = videoRef.current;
        if (el) el.volume = volume;
    }, [volume, current?.asset.url]);

    const onTimeUpdate = () => {
        const el = videoRef.current;
        if (!el || !current || !editor.playing) return;
        editor.setPlayhead(current.clip.start + (el.currentTime - current.clip.offset));
    };

    // The keys people press without thinking, plus Delete and space.
    // Bound on the editor's own element rather than the window so they
    // stay inside this room and never fire while somebody is typing in
    // a field.
    const onKeyDown = (event: ReactKeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

        const mod = event.metaKey || event.ctrlKey;
        if (mod && event.key.toLowerCase() === "z") {
            event.preventDefault();
            if (event.shiftKey) editor.redo();
            else editor.undo();
            return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            editor.deleteSelected();
            return;
        }
        if (event.key === " ") {
            event.preventDefault();
            editor.setPlaying(!editor.playing);
        }
    };

    const step = (seconds: number) => editor.setPlayhead(editor.playhead + seconds);

    /** Video files in the project's folder — what can be transcribed. */
    const videoAssets = editor.assets.filter((a) => a.kind === "video");

    /**
     * Which file the transcription should run on, if nobody says
     * otherwise: whatever the preview is showing.
     *
     * That is the whole point of doing this from the editor. The file
     * under the playhead is the one you are looking at, and it is the
     * one you mean — where before, the job read an absolute path that
     * had been typed into a field on another screen and had no
     * connection to what was on the timeline.
     */
    const fileUnderPlayhead = (): string => {
        const under = editor.clipAt(editor.playhead);
        if (under) return under.asset.serverFile;
        const first = editor.clips.find((c) => c.text === undefined);
        const asset = first ? editor.assets.find((a) => a.id === first.assetId) : undefined;
        return asset?.serverFile ?? videoAssets[0]?.serverFile ?? "";
    };

    /**
     * Subtitles from the video's own transcript — the timestamps whisper
     * wrote have been on disk since it ran, and this is what reads them
     * back as something you can see.
     */
    const importSubtitles = () => {
        setSubtitleError(null);
        setLoadingSubs(true);
        fetchTranscript(project.id)
            .then((t) => {
                if (t.segments.length === 0) {
                    setSubtitleError("The transcript has no timings — subtitles need whisper's segment data.");
                    return;
                }
                editor.setSubtitles(t.segments);
                setSubs("closed");
            })
            .catch((e) => {
                // 409 means there is no finished transcript, which is
                // the ordinary state of a video nobody has transcribed —
                // the next step, not a failure. Anything else is one.
                if (e instanceof VideoStepBlockedError) {
                    setSubFile(fileUnderPlayhead());
                    setSubs("picking");
                    return;
                }
                setSubtitleError(e instanceof Error ? e.message : "Could not read the transcript.");
            })
            .finally(() => setLoadingSubs(false));
    };

    const runTranscribe = () => {
        setSubtitleError(null);
        setSubs("transcribing");
        void startTranscription(project.id, { file: subFile, language: subLanguage })
            .catch((e) => {
                setSubtitleError(e instanceof Error ? e.message : "Could not start the transcription.");
                setSubs("picking");
            });
    };

    /**
     * Follows the row while whisper runs, and lays the subtitles down
     * the moment it finishes.
     *
     * The job lives in the server process and the row simply changes
     * underneath, so there is nothing to subscribe to. The poll stops
     * completely when it is not running.
     */
    useEffect(() => {
        if (subs !== "transcribing") return;
        const timer = setInterval(() => {
            void fetchVideoProject(project.id).then((latest) => {
                if (latest.transcriptStatus === "done") {
                    setSubs("closed");
                    void fetchTranscript(project.id)
                        .then((t) => editor.setSubtitles(t.segments))
                        .catch((e) => setSubtitleError(e instanceof Error ? e.message : "Could not read the transcript."));
                } else if (latest.transcriptStatus === "failed") {
                    // Never empty when the status is 'failed' — the
                    // server writes what actually went wrong.
                    setSubtitleError(latest.transcriptError ?? "The transcription failed.");
                    setSubs("picking");
                }
            }).catch(() => { /* the next poll is three seconds away */ });
        }, TRANSCRIPT_POLL);
        return () => clearInterval(timer);
        // `editor` is rebuilt on every render, so listing it would tear
        // down and restart the poll continuously. Only the two things
        // that decide whether to poll at all are listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subs, project.id]);

    const addTitle = () => editor.addText("Title", editor.playhead, 3);

    // Measured, not asked of a model: clip lengths, the decoded peak
    // envelope, and where the first picture starts are all already here.
    const analyse = () => setFindings(analyseEdit(editor.clips, editor.assets));

    /**
     * The dead air, taken out.
     *
     * The same measurement ANALYZE has been reporting since Sprint 097,
     * finally performed. One undoable step, because it moves every clip
     * on every track and a hundred history entries describing one action
     * would make undo a slow rewind rather than a way back.
     */
    const removeSilence = () => {
        const result = cutSilence(editor.clips, editor.assets);
        if (result.gaps === 0) {
            setCutReport("Nothing to take out — no gap long enough, or something is audible the whole way through.");
            return;
        }
        editor.replaceClips(result.clips);
        setCutReport(
            `Took out ${result.removed.toFixed(1)} s across ${result.gaps} ${result.gaps === 1 ? "gap" : "gaps"}. `
            + "Cmd-Z puts it back.",
        );
    };

    // What it WOULD take out, so the button can say so before you press
    // it. Cheap enough to work out on every render: it walks the peak
    // arrays that are already in memory.
    const silence = findSilence(editor.clips, editor.assets);
    const silentSeconds = silence.reduce((n, r) => n + (r.end - r.start), 0);

    /**
     * Export sends the bytes first, then the edit.
     *
     * The editor's media are object URLs the server cannot see, so
     * anything not already uploaded goes up now rather than at import —
     * a file you imported and never used shouldn't cost an upload.
     */
    /** What the render and the hand-off both need: the edit, as files
     *  in the project's folder plus the text laid over it. */
    const buildRequest = () => {
        const media = editor.clips.filter((c) => c.text === undefined);
        const files = new Map<string, string>();
        for (const clip of media) {
            const asset = editor.assets.find((a) => a.id === clip.assetId);
            if (asset) files.set(clip.assetId, asset.serverFile);
        }
        const first = editor.assets.find((a) => a.id === media[0]?.assetId);
        return {
            media,
            clips: media.map((c) => ({
                file: files.get(c.assetId) ?? "",
                start: c.start,
                duration: c.duration,
                offset: c.offset,
                kind: editor.tracks.find((t) => t.id === c.trackId)?.kind ?? "video",
            })).filter((c) => c.file),
            width: first?.width && first.width > 0 ? first.width : 1920,
            height: first?.height && first.height > 0 ? first.height : 1080,
        };
    };

    /**
     * Hands the cut to Resolve rather than rendering it.
     *
     * Finishing happens there, so the useful thing is to arrive with
     * the cut already made. Nothing is copied — the FCPXML points at
     * the same files in the same folder.
     */
    const handToResolve = async () => {
        setExportError(null);
        setResolveDone(null);
        const built = buildRequest();
        if (built.clips.length === 0) {
            setExportError("Nothing on the timeline to hand over.");
            return;
        }
        try {
            setExporting("Writing…");
            const result = await sendToResolve(project.id, {
                clips: built.clips,
                texts: editor.clips.filter((c) => c.text !== undefined)
                    .map((c) => ({ text: c.text ?? "", start: c.start, duration: c.duration })),
                width: built.width,
                height: built.height,
                crossfade: 0,
            });
            setResolveDone(result);
        } catch (e) {
            setExportError(e instanceof Error ? e.message : "Could not write the Resolve project.");
        } finally {
            setExporting(null);
        }
    };

    const runExport = async () => {
        setExportError(null);
        setExportDone(null);
        setSavedTo(null);
        const media = editor.clips.filter((c) => c.text === undefined);
        if (media.length === 0) {
            setExportError("Nothing on the timeline to export.");
            return;
        }
        try {
            // Nothing to upload: every clip already names a file in the
            // project's folder, which is where the render reads from.
            const files = new Map<string, string>();
            for (const clip of media) {
                const asset = editor.assets.find((a) => a.id === clip.assetId);
                if (asset) files.set(clip.assetId, asset.serverFile);
            }

            const clips = media.map((c) => ({
                file: files.get(c.assetId) ?? "",
                start: c.start,
                duration: c.duration,
                offset: c.offset,
                kind: editor.tracks.find((t) => t.id === c.trackId)?.kind ?? "video" as "video" | "audio",
            })).filter((c) => c.file);

            const first = editor.assets.find((a) => a.id === media[0].assetId);
            const native = {
                width: first?.width && first.width > 0 ? first.width : 1920,
                height: first?.height && first.height > 0 ? first.height : 1080,
            };

            // One render per shape, in sequence rather than at once:
            // each one saturates the machine's encoder, so two in
            // parallel finish no sooner and make either one's progress
            // meaningless.
            const chosen = EXPORT_PRESETS.filter((p) => shapes.includes(p.variant));
            const done: { variant: string; label: string; bytes: number; warnings: string[] }[] = [];

            for (const preset of chosen) {
                // The native shape keeps the footage's own size; the
                // rest use the preset's, because reframing to 9:16 at
                // the source's resolution would be an accident.
                const width = preset.variant === "" ? native.width : preset.width;
                const height = preset.variant === "" ? native.height : preset.height;

                // Captions are drawn per shape, at the size they will
                // really have. A caption laid out for 1920 wide and
                // dropped onto a 1080-wide vertical frame would run off
                // both edges.
                setExporting(`${preset.label} — captions…`);
                const texts = editor.clips
                    .filter((c) => c.text !== undefined)
                    .map((c) => {
                        const drawn = renderCaption(c.text ?? "", c.start, c.duration, width, height);
                        return drawn
                            ? { text: c.text ?? "", ...drawn }
                            : { text: c.text ?? "", start: c.start, duration: c.duration };
                    });

                setExporting(`${preset.label} — rendering…`);
                const result = await exportTimeline(project.id, {
                    clips, texts, width, height,
                    fit: preset.fit,
                    variant: preset.variant,
                    crossfade: 0,
                });
                done.push({ variant: preset.variant, label: preset.label, bytes: result.bytes, warnings: result.warnings });
            }
            setExportDone(done);

            // Then ask where it goes. The render is already safe in the
            // project's Exports folder — this is the copy that lands
            // where you actually want it, one dialog per shape.
            const saved: string[] = [];
            for (const d of done) {
                setExporting(`${d.label} — saving…`);
                const name = `${project.title.replace(/[/\\:]/g, "-")}${d.variant ? `-${d.variant}` : ""}.mp4`;
                const outcome = await saveRenderAs(exportFileUrl(project.id, d.variant), name);
                if (outcome === "cancelled") break;
                saved.push(`${d.label} ${outcome === "saved" ? "saved" : "downloaded"}`);
            }
            setSavedTo(saved.length > 0
                ? `${saved.join(", ")}. A copy stays in the project's Exports folder either way.`
                : "Not saved anywhere else — the render is in the project's Exports folder.");
        } catch (e) {
            setExportError(e instanceof Error ? e.message : "Could not export.");
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="studio-editor" tabIndex={-1} onKeyDown={onKeyDown} ref={rootRef}>

            {/* Project bar — what you're working on, and what you do to
                the whole of it. Thin on purpose: it must not compete
                with the picture. */}
            <div className="studio-projectbar">
                <div className="studio-projectbar-left">
                    <button type="button" className="studio-back" onClick={onBack}>
                        <ChevronLeft size={15} strokeWidth={2} />
                        Projects
                    </button>
                    <span className="studio-project-name">{project.title}</span>
                    <span className="studio-project-meta">
                        16:9 · {formatClock(editor.duration)} · {editor.clips.length} clips
                    </span>
                </div>
                <div className="studio-projectbar-right">
                    <button type="button" className="studio-bar-btn" onClick={editor.undo} disabled={!editor.canUndo}>
                        <Undo2 size={13} strokeWidth={2} />Undo
                    </button>
                    <button type="button" className="studio-bar-btn" onClick={editor.redo} disabled={!editor.canRedo}>
                        <Redo2 size={13} strokeWidth={2} />Redo
                    </button>
                    {/* Which shapes to render. Client work almost always
                        wants more than one, and rendering them from one
                        cut is the whole point of asking here rather
                        than re-cutting for each. */}
                    <span className="studio-shapes">
                        {EXPORT_PRESETS.map((p) => (
                            <button
                                key={p.variant}
                                type="button"
                                className={`studio-shape${shapes.includes(p.variant) ? " studio-shape-on" : ""}`}
                                aria-pressed={shapes.includes(p.variant)}
                                onClick={() => setShapes((was) => (
                                    was.includes(p.variant)
                                        // Never all of them off — EXPORT
                                        // would then have nothing to do
                                        // and no way to say why.
                                        ? (was.length === 1 ? was : was.filter((v) => v !== p.variant))
                                        : [...was, p.variant]
                                ))}
                            >
                                {p.label}
                            </button>
                        ))}
                    </span>

                    <span className="studio-bar-divider" />
                    {/* The cut saves itself, so this is a read-out
                        rather than a button — until it fails, which is
                        the one state you can do something about. */}
                    {saveState === "failed" ? (
                        <button type="button" className="studio-bar-btn studio-save-retry" onClick={() => setRetry((n) => n + 1)}>
                            Not saved — retry
                        </button>
                    ) : (
                        <span className={`studio-save studio-save-${saveState === "saving" ? "saving" : dirty ? "dirty" : "clean"}`}>
                            {saveState === "saving" ? "Saving…" : dirty ? "Unsaved" : "Saved"}
                        </span>
                    )}
                    <button
                        type="button"
                        className="studio-bar-btn"
                        onClick={() => void handToResolve()}
                        disabled={exporting !== null || editor.clips.length === 0}
                        title="Write the cut as an FCPXML beside the footage, for DaVinci Resolve"
                    >
                        To Resolve
                    </button>
                    <button
                        type="button"
                        className="studio-bar-btn studio-bar-btn-export"
                        onClick={() => void runExport()}
                        disabled={exporting !== null || editor.clips.length === 0}
                    >
                        {exporting ?? "EXPORT"}
                    </button>
                </div>
            </div>

            <div className="studio-body">

                {/* LEFT · media */}
                <aside className="studio-media">
                    <div className="studio-folder">
                        <Upload size={13} strokeWidth={2} />
                        <span>{owner ? "Project folder" : "No project folder"}</span>
                    </div>
                    {/* The files are already on disk. Putting one in the
                        folder from Finder is the import. */}
                    <p className="studio-import-hint">
                        {owner ? "Drop footage into the project's folder in Finder." : "This video isn't in a project yet."}
                    </p>
                    {editor.assets.length > 0 && (
                        <p className="studio-import-hint studio-import-hint-drag">Drag a clip onto a track, or use Add.</p>
                    )}

                    <div className="studio-asset-list">
                        {editor.assets.length === 0 ? (
                            <p className="studio-empty">Nothing imported yet.</p>
                        ) : editor.assets.map((asset) => (
                            <div
                                key={asset.id}
                                className="studio-asset"
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("application/x-kiwi-asset", asset.id);
                                    e.dataTransfer.effectAllowed = "copy";
                                }}
                            >
                                <div
                                    className={`studio-asset-thumb studio-asset-thumb-${asset.kind}`}
                                    style={asset.frames[0] ? { backgroundImage: `url(${asset.frames[0]})` } : undefined}
                                >
                                    {!asset.frames[0] && asset.kind === "video" && <Film size={15} strokeWidth={1.75} />}
                                    {asset.kind === "audio" && <Music2 size={15} strokeWidth={1.75} />}
                                </div>
                                <div className="studio-asset-meta">
                                    <span className="studio-asset-name">{asset.name}</span>
                                    <span className="studio-asset-sub">
                                        {formatClock(asset.duration)}
                                        {asset.width > 0 && ` · ${asset.width}×${asset.height}`}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="studio-asset-add"
                                    onClick={() => editor.addClip(asset.id)}
                                    aria-label={`Add ${asset.name} to the timeline`}
                                >
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* CENTER · the picture */}
                <section className="studio-viewer">
                    <div className="studio-preview">
                        {current ? (
                            <video
                                ref={videoRef}
                                key={current.asset.id}
                                src={current.asset.url}
                                className="studio-video"
                                onTimeUpdate={onTimeUpdate}
                                onEnded={() => editor.setPlaying(false)}
                                playsInline
                            />
                        ) : (
                            <div className="studio-preview-empty">
                                <Clapperboard size={30} strokeWidth={1.25} />
                                <span>{editor.clips.length === 0 ? "Import something and add it to the timeline." : "Nothing under the playhead."}</span>
                            </div>
                        )}

                        {/* Drawn over the picture rather than beside it —
                            a subtitle you have to look somewhere else to
                            read tells you nothing about how it sits on
                            the frame. */}
                        {editor.textAt(editor.playhead).map((clip) => (
                            <div key={clip.id} className="studio-caption">{clip.text}</div>
                        ))}
                    </div>

                    <div className="studio-transport">
                        <button type="button" className="studio-transport-btn" onClick={() => step(-1 / 25)} aria-label="Previous frame"><SkipBack size={16} strokeWidth={2} /></button>
                        <button
                            type="button"
                            className="studio-play"
                            onClick={() => editor.setPlaying(!editor.playing)}
                            disabled={!current}
                            aria-label={editor.playing ? "Pause" : "Play"}
                        >
                            {editor.playing
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                        </button>
                        <button type="button" className="studio-transport-btn" onClick={() => step(1 / 25)} aria-label="Next frame"><SkipForward size={16} strokeWidth={2} /></button>

                        <span className="studio-time">
                            <strong>{formatClock(editor.playhead)}</strong> / {formatClock(editor.duration)}
                        </span>

                        <div className="studio-transport-spacer" />

                        <Volume2 size={15} strokeWidth={2} className="studio-transport-icon" />
                        <input
                            type="range" min={0} max={1} step={0.05} value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="studio-volume" aria-label="Volume"
                        />
                    </div>
                </section>

                {/* RIGHT · KIWI */}
                <aside className="studio-ai">
                    <div className="studio-ai-head">
                        <Sparkles size={14} strokeWidth={2} />
                        KIWI AI
                    </div>
                    <button type="button" className="studio-ai-analyze" onClick={analyse} disabled={editor.clips.length === 0}>
                        ANALYZE VIDEO
                    </button>

                    {/* The one finding that can be acted on rather than
                        read. It says how much it will take before you
                        press it, because a cut you can't predict is one
                        you undo. */}
                    <button
                        type="button"
                        className="studio-ai-cut"
                        onClick={removeSilence}
                        disabled={silence.length === 0}
                    >
                        <Scissors size={13} strokeWidth={2} />
                        {silence.length === 0
                            ? "No dead air to cut"
                            : `Cut ${silentSeconds.toFixed(1)} s of dead air`}
                    </button>

                    {cutReport && <p className="studio-ai-reason">{cutReport}</p>}

                    {editor.clips.length === 0 && (
                        <p className="studio-ai-reason">Nothing on the timeline to look at yet.</p>
                    )}

                    <div className="studio-ai-body">
                        {findings === null ? (
                            <p className="studio-ai-placeholder">
                                Pacing, long shots, silence, audio levels and clip-worthy moments land here once the
                                analysis runs.
                            </p>
                        ) : findings.length === 0 ? (
                            <p className="studio-ai-placeholder">
                                Nothing stood out — no long shots, no silences, nothing near clipping.
                            </p>
                        ) : (
                            <div className="studio-findings">
                                {findings.map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        className={`studio-finding studio-finding-${f.kind}`}
                                        onClick={() => editor.setPlayhead(f.start)}
                                    >
                                        <span className="studio-finding-time">
                                            {formatClock(f.start)} – {formatClock(f.end)}
                                        </span>
                                        <span className="studio-finding-text">{f.text}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="studio-ai-boundary">
                        KIWI suggests. It never changes your timeline — you decide what to act on.
                    </p>
                </aside>
            </div>

            {/* Toolbar + timeline */}
            <div className="studio-toolbar">
                <div className="studio-tools">
                    <button type="button" className="studio-tool studio-tool-active"><Clapperboard size={13} strokeWidth={2} />Select</button>
                    <button type="button" className="studio-tool" onClick={() => editor.splitAt(editor.playhead)}><Scissors size={13} strokeWidth={2} />Split</button>
                    <button type="button" className="studio-tool" onClick={editor.deleteSelected} disabled={!editor.selectedClipId}><Trash2 size={13} strokeWidth={2} />Delete</button>
                    <span className="studio-bar-divider" />
                    <button type="button" className="studio-tool" onClick={addTitle}><Type size={13} strokeWidth={2} />Text</button>
                    <button type="button" className="studio-tool" onClick={importSubtitles} disabled={loadingSubs}>
                        <Captions size={13} strokeWidth={2} />{loadingSubs ? "Reading…" : "Subtitles"}
                    </button>
                </div>
                <div className="studio-zoom">
                    <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} aria-label="Zoom out"><ZoomOut size={14} strokeWidth={2} /></button>
                    <span>{pxPerSecond}px/s</span>
                    <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))} aria-label="Zoom in"><ZoomIn size={14} strokeWidth={2} /></button>
                </div>
            </div>

            {/* The transcript job, driven from the room it belongs to.
                The file is the one under the playhead and the language
                is the video's own, so both are already answered — this
                is here to be corrected, not filled in. */}
            {subs !== "closed" && (
                <div className="studio-subs">
                    <Captions size={14} strokeWidth={2} />
                    {subs === "transcribing" ? (
                        <span className="studio-subs-running">
                            Transcribing{subFile ? ` ${subFile}` : ""} — whisper is running on this machine.
                            Subtitles land on V3 when it finishes, and you can keep cutting meanwhile.
                        </span>
                    ) : videoAssets.length === 0 ? (
                        <span className="studio-subs-running">
                            Nothing in the project's folder to transcribe.
                        </span>
                    ) : (
                        <>
                            <span className="studio-subs-label">No transcript yet. Transcribe</span>
                            <select
                                className="studio-subs-select"
                                value={subFile}
                                onChange={(e) => setSubFile(e.target.value)}
                                aria-label="File to transcribe"
                            >
                                {videoAssets.map((a) => (
                                    <option key={a.id} value={a.serverFile}>{a.name}</option>
                                ))}
                            </select>
                            <span className="studio-subs-label">spoken in</span>
                            <select
                                className="studio-subs-select"
                                value={subLanguage}
                                onChange={(e) => setSubLanguage(e.target.value)}
                                aria-label="Language spoken on the video"
                            >
                                {VIDEO_LANGUAGES.map((l) => (
                                    <option key={l.value} value={l.value}>{l.label}</option>
                                ))}
                            </select>
                            <button type="button" className="studio-subs-run" onClick={runTranscribe} disabled={!subFile}>
                                Transcribe
                            </button>
                            <button type="button" className="studio-subs-close" onClick={() => setSubs("closed")}>
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            )}

            {selectedText && (
                <div className="studio-text-edit">
                    <Type size={14} strokeWidth={2} />
                    <input
                        value={selectedText.text ?? ""}
                        onChange={(e) => editor.updateText(selectedText.id, e.target.value)}
                        placeholder="What it says…"
                        aria-label="Text"
                    />
                    <span className="studio-text-edit-time">
                        {formatClock(selectedText.start)} – {formatClock(selectedText.start + selectedText.duration)}
                    </span>
                </div>
            )}

            {resolveDone && (
                <div className="studio-export-done">
                    <span>
                        Cut written for Resolve — <code>{resolveDone.fcpxml.split("/").pop()}</code>
                        {resolveDone.srt && <> and <code>{resolveDone.srt.split("/").pop()}</code></>}
                        {" "}in the project's folder. In Resolve: File → Import → Timeline.
                    </span>
                    {resolveDone.warnings.map((w) => <span key={w} className="studio-export-warning">{w}</span>)}
                </div>
            )}

            {subtitleError && <p className="studio-subtitle-error">{subtitleError}</p>}
            {exportError && <p className="studio-subtitle-error">{exportError}</p>}
            {exportDone && (
                <div className="studio-export-done">
                    {exportDone.map((d) => (
                        <span key={d.variant}>
                            <strong>{d.label}</strong> — {(d.bytes / 1_000_000).toFixed(1)} MB —{" "}
                            <a href={exportFileUrl(project.id, d.variant)} target="_blank" rel="noreferrer">open the file</a>
                        </span>
                    ))}
                    {/* A render that quietly dropped something is worse
                        than one that failed: this says what it couldn't
                        do, in the same breath as the success. */}
                    {savedTo && <span className="studio-export-saved">{savedTo}</span>}
                    {!canPickFolder() && (
                        <span className="studio-export-warning">
                            This browser has no Save As dialog, so the copy went to your Downloads folder.
                        </span>
                    )}
                    {[...new Set(exportDone.flatMap((d) => d.warnings))]
                        .map((w) => <span key={w} className="studio-export-warning">{w}</span>)}
                </div>
            )}

            <StudioTimeline editor={editor} pxPerSecond={pxPerSecond} />
        </div>
    );
}
