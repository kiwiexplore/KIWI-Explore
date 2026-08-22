import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
    Captions, ChevronLeft, Clapperboard, Film, Music2, Redo2, Scissors, SkipBack, SkipForward,
    Sparkles, Trash2, Type, Undo2, Upload, Volume2, ZoomIn, ZoomOut,
} from "lucide-react";
import { useStudioEditorState } from "../../state/studioEditor";
import { fetchTranscript, type VideoProject } from "../../lib/videoApi";
import StudioTimeline from "./StudioTimeline";
import { formatClock } from "../../lib/timecode";
import "./StudioEditor.css";

const ZOOM_STEPS = [2, 4, 8, 16, 32, 64];

interface StudioEditorProps {
    project: VideoProject;
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
export default function StudioEditor({ project, onBack }: StudioEditorProps) {
    const editor = useStudioEditorState();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [zoom, setZoom] = useState(2);
    const [dragOver, setDragOver] = useState(false);
    const [volume, setVolume] = useState(1);
    const rootRef = useRef<HTMLDivElement>(null);
    const [subtitleError, setSubtitleError] = useState<string | null>(null);
    const [loadingSubs, setLoadingSubs] = useState(false);

    // Focus the editor on open so the shortcuts work without demanding
    // a click somewhere first.
    useEffect(() => { rootRef.current?.focus(); }, []);

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

    const handleDrop = (event: DragEvent) => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer?.files?.length) void editor.importFiles(event.dataTransfer.files);
    };

    const step = (seconds: number) => editor.setPlayhead(editor.playhead + seconds);

    /**
     * Subtitles from the video's own transcript — the timestamps whisper
     * wrote have been on disk since it ran, and this is the first thing
     * that reads them back as something you can see.
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
            })
            .catch((e) => setSubtitleError(e instanceof Error ? e.message : "Could not read the transcript."))
            .finally(() => setLoadingSubs(false));
    };

    const addTitle = () => editor.addText("Title", editor.playhead, 3);

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
                    <span className="studio-bar-divider" />
                    <button type="button" className="studio-bar-btn">Save</button>
                    <button type="button" className="studio-bar-btn studio-bar-btn-export">EXPORT</button>
                </div>
            </div>

            <div className="studio-body">

                {/* LEFT · media */}
                <aside
                    className={`studio-media${dragOver ? " studio-media-dragover" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <label className="studio-import">
                        <Upload size={15} strokeWidth={2} />
                        IMPORT MEDIA
                        <input
                            type="file"
                            multiple
                            accept="video/*,audio/*,image/*"
                            onChange={(e) => { if (e.target.files) void editor.importFiles(e.target.files); }}
                        />
                    </label>
                    <p className="studio-import-hint">or drop files here</p>
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
                <section className="studio-stage">
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
                    <button type="button" className="studio-ai-analyze" disabled={editor.clips.length === 0}>
                        ANALYZE VIDEO
                    </button>
                    {editor.clips.length === 0 && (
                        <p className="studio-ai-reason">Nothing on the timeline to look at yet.</p>
                    )}

                    <div className="studio-ai-body">
                        <p className="studio-ai-placeholder">
                            Pacing, long shots, silence, audio levels and clip-worthy moments land here once the
                            analysis runs.
                        </p>
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

            {subtitleError && <p className="studio-subtitle-error">{subtitleError}</p>}

            <StudioTimeline editor={editor} pxPerSecond={pxPerSecond} />
        </div>
    );
}
