import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import {
    AlertTriangle, ArrowLeft, Check, Clapperboard, FileText, Info, Instagram, Loader2, Megaphone,
    Film, Music2, Plus, RotateCcw, Scissors, SlidersHorizontal, Trash2, Wand2,
} from "lucide-react";
import type { VideoBusyAction, VideoStudioState } from "../../state/videoStudio";
import type { DerivedContentType, TranscriptStatus, VideoProject, VideoStage } from "../../lib/videoApi";
import { VIDEO_LANGUAGES, VIDEO_STAGES } from "../../lib/videoApi";
import type { ContentItem } from "../../lib/contentApi";
import "./GlobalBoard.css";
import "./VideoStudioBoard.css";

const STAGE_META: Record<VideoStage, { label: string; color: string }> = {
    idea: { label: "Idea", color: "var(--text-muted)" },
    script: { label: "Script", color: "var(--primary)" },
    recorded: { label: "Recorded", color: "var(--accent)" },
    transcribing: { label: "Transcribing", color: "var(--accent)" },
    editing: { label: "Editing", color: "#F5C451" },
    published: { label: "Published", color: "var(--secondary)" },
};

const TRANSCRIPT_META: Record<TranscriptStatus, { label: string; color: string }> = {
    pending: { label: "Not transcribed", color: "var(--text-muted)" },
    processing: { label: "Transcribing…", color: "var(--primary)" },
    done: { label: "Transcript ready", color: "var(--secondary)" },
    failed: { label: "Transcript failed", color: "var(--danger)" },
};

const DERIVED_META: Record<DerivedContentType, { label: string; icon: typeof Megaphone }> = {
    ad: { label: "Ad", icon: Megaphone },
    "instagram-post": { label: "Instagram post", icon: Instagram },
    "tiktok-post": { label: "TikTok post", icon: Music2 },
};

const DERIVED_ORDER: DerivedContentType[] = ["ad", "instagram-post", "tiktok-post"];

const CONTENT_TYPE_LABEL: Record<ContentItem["type"], string> = {
    "youtube-script": "Script",
    "instagram-post": "Instagram post",
    "tiktok-post": "TikTok post",
    ad: "Ad",
};

function formatClock(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

interface GatedButtonProps {
    label: string;
    icon: typeof Wand2;
    onClick: () => void;
    /**
     * Why this action can't run yet, or null when it can. The text is
     * rendered next to the button, not hidden in a title attribute — a
     * tooltip never appears on touch and is easy to miss, and "the
     * button does nothing and won't say why" is the thing this whole
     * pattern exists to avoid.
     */
    blockedReason: string | null;
    busy: boolean;
    busyLabel?: string;
    primary?: boolean;
}

function GatedButton({ label, icon: Icon, onClick, blockedReason, busy, busyLabel, primary }: GatedButtonProps) {
    const reasonId = useId();
    const blocked = blockedReason !== null;
    return (
        <div className="video-studio-action">
            <button
                type="button"
                className={`video-studio-action-btn${primary ? " video-studio-action-btn-primary" : ""}`}
                onClick={onClick}
                disabled={blocked || busy}
                aria-describedby={blocked ? reasonId : undefined}
            >
                {busy ? <Loader2 size={14} strokeWidth={2} className="video-studio-spin" /> : <Icon size={14} strokeWidth={1.75} />}
                {busy ? busyLabel ?? "Working…" : label}
            </button>
            {blocked && <span className="video-studio-action-reason" id={reasonId}>{blockedReason}</span>}
        </div>
    );
}

type StepState = "done" | "current" | "upcoming";

/**
 * One step of the video's own pipeline. The detail used to be five
 * equal-looking panels stacked down the page, which said nothing about
 * order — this numbers them and marks what's finished, so the page
 * itself tells you where you are without reading every box.
 */
function Step({ n, title, state, children }: {
    n: number; title: string; state: StepState; children: React.ReactNode;
}) {
    return (
        <section className={`video-studio-panel video-studio-step video-studio-step-${state}`}>
            <div className="video-studio-step-head">
                <span className="video-studio-step-num">
                    {state === "done" ? <Check size={11} strokeWidth={3.5} /> : n}
                </span>
                <h2>{title}</h2>
                {state === "current" && <span className="video-studio-step-now">Now</span>}
            </div>
            {children}
        </section>
    );
}

function StageBadge({ stage }: { stage: VideoStage }) {
    const meta = STAGE_META[stage];
    return (
        <span className="video-studio-badge" style={{ color: meta.color, borderColor: meta.color }}>
            {meta.label}
        </span>
    );
}

interface VideoCardProps {
    project: VideoProject;
    onOpen: () => void;
}

function VideoCard({ project, onOpen }: VideoCardProps) {
    return (
        <button type="button" className="video-studio-card" onClick={onOpen}>
            <div className="video-studio-card-top">
                <Clapperboard size={15} strokeWidth={1.75} />
                <StageBadge stage={project.stage} />
            </div>
            <span className="video-studio-card-title">{project.title}</span>
            <div className="video-studio-card-meta">
                {/* A failed transcript is surfaced on the card itself,
                    not only inside the detail — a failure you have to
                    open something to discover is barely better than a
                    silent one. */}
                {project.transcriptStatus === "failed" && (
                    <span className="video-studio-card-failed">
                        <AlertTriangle size={12} strokeWidth={2} />
                        Transcript failed
                    </span>
                )}
                {project.transcriptStatus === "processing" && (
                    <span className="video-studio-card-processing">
                        <Loader2 size={12} strokeWidth={2} className="video-studio-spin" />
                        Transcribing…
                    </span>
                )}
                {project.contentItems.length > 0 && (
                    <span className="video-studio-card-count">{project.contentItems.length} attached</span>
                )}
            </div>
        </button>
    );
}

function ContentItemRow({ item }: { item: ContentItem }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="video-studio-content-item">
            <button type="button" className="video-studio-content-item-head" onClick={() => setExpanded((open) => !open)}>
                <span className="video-studio-content-item-type">{CONTENT_TYPE_LABEL[item.type]}</span>
                <span className="video-studio-content-item-topic">{item.topic}</span>
                <span className="video-studio-content-item-status">{item.status}</span>
            </button>
            {expanded && <pre className="video-studio-content-item-body">{item.content}</pre>}
        </div>
    );
}

interface VideoDetailProps {
    project: VideoProject;
    busy: VideoBusyAction | undefined;
    videoStudio: VideoStudioState;
    onBack: () => void;
    onOpenEditor: () => void;
}

function VideoDetail({ project, busy, videoStudio, onBack, onOpenEditor }: VideoDetailProps) {
    const [pathDraft, setPathDraft] = useState(project.sourceVideoPath ?? "");
    const [brief, setBrief] = useState("");
    // Held locally and committed on blur/Enter rather than on every
    // keystroke — the alternative is a PATCH per character typed.
    const [titleDraft, setTitleDraft] = useState(project.title);

    const commitTitle = () => {
        const next = titleDraft.trim();
        if (!next || next === project.title) {
            setTitleDraft(project.title);
            return;
        }
        videoStudio.update(project.id, { title: next });
    };

    const transcriptMeta = TRANSCRIPT_META[project.transcriptStatus];
    const script = project.contentItems.find((item) => item.type === "youtube-script");
    const derived = project.contentItems.filter((item) => item.type !== "youtube-script");

    // Every gate below mirrors a check the server makes too (see
    // routes/video.ts) — this half is the explanation, that half is the
    // guarantee.
    const transcribeBlocked = !project.sourceVideoPath
        ? "Add the path to the recorded video file first — there's nothing to transcribe yet."
        : project.transcribing || project.transcriptStatus === "processing"
            ? "A transcription is already running for this video."
            : null;

    const clipsBlocked = project.transcriptStatus === "done"
        ? null
        : project.transcriptStatus === "failed"
            ? "Needs a finished transcript — the last transcription failed. Fix the cause and run it again."
            : project.transcriptStatus === "processing"
                ? "Needs a finished transcript — one is running right now."
                : "Needs a finished transcript — this video hasn't been transcribed yet.";

    const derivedBlocked = project.transcriptStatus === "done" || script
        ? null
        : "Needs something to work from — draft a script, or finish a transcript of the recording.";

    // Each step is done once the thing it produces exists. The first one
    // that isn't is "now" — the same first-empty rule the pipeline board
    // uses, so the two never disagree about where a video stands.
    const done = [
        Boolean(script),
        Boolean(project.sourceVideoPath),
        project.transcriptStatus === "done",
        project.clips.length > 0,
        derived.length > 0,
        project.stage === "published",
    ];
    const currentIndex = done.indexOf(false);
    const stepState = (i: number): StepState => done[i] ? "done" : i === currentIndex ? "current" : "upcoming";

    return (
        <div className="video-studio-detail">
            <button type="button" className="video-studio-back" onClick={onBack}>
                <ArrowLeft size={15} strokeWidth={2} />
                All videos
            </button>

            <div className="video-studio-detail-head">
                <input
                    className="video-studio-title-input"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    }}
                    aria-label="Video title"
                />
                <div className="video-studio-detail-head-right">
                    <button type="button" className="video-studio-open-editor" onClick={onOpenEditor}>
                        <SlidersHorizontal size={14} strokeWidth={2} />
                        Open the editor
                    </button>
                    <label className="video-studio-stage-picker">
                        <span>Stage</span>
                        <select
                            value={project.stage}
                            onChange={(e) => videoStudio.update(project.id, { stage: e.target.value as VideoStage })}
                        >
                            {VIDEO_STAGES.map((stage) => (
                                <option key={stage} value={stage}>{STAGE_META[stage].label}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        className="video-studio-delete"
                        onClick={() => { videoStudio.remove(project.id); onBack(); }}
                        aria-label="Delete this video project"
                    >
                        <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                </div>
            </div>

            <div className="global-board-notice">
                <Info size={14} strokeWidth={2} />
                <span>
                    Stage is yours to set — KIWI doesn't publish to YouTube or Meta Ads and doesn't read anything back
                    from them, so "Published" here means you said so, not that anything went live.
                </span>
            </div>

            <Step n={1} title="Script" state={stepState(0)}>
                {script ? (
                    <ContentItemRow item={script} />
                ) : (
                    <>
                        <textarea
                            className="video-studio-brief"
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            placeholder="Optional: what should this video cover? Angle, audience, anything it must mention."
                            rows={3}
                        />
                        <div className="video-studio-actions">
                            <GatedButton
                                label="Draft a script"
                                icon={Wand2}
                                onClick={() => videoStudio.draftScript(project.id, brief.trim())}
                                blockedReason={null}
                                busy={busy === "script"}
                                busyLabel="Writing…"
                                primary
                            />
                        </div>
                    </>
                )}
            </Step>

            <Step n={2} title="Recording" state={stepState(1)}>
                <div className="video-studio-path-row">
                    <input
                        className="video-studio-path-input"
                        value={pathDraft}
                        onChange={(e) => setPathDraft(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "Enter") { e.preventDefault(); videoStudio.update(project.id, { sourceVideoPath: pathDraft.trim() || null }); }
                        }}
                        placeholder="/Users/you/Movies/take-01.mov"
                        aria-label="Path to the recorded video file"
                    />
                    <button
                        type="button"
                        className="video-studio-action-btn"
                        onClick={() => videoStudio.update(project.id, { sourceVideoPath: pathDraft.trim() || null })}
                        disabled={pathDraft.trim() === (project.sourceVideoPath ?? "")}
                    >
                        Save path
                    </button>
                </div>
                <label className="video-studio-lang">
                    <span>Spoken language</span>
                    <select
                        value={project.language}
                        onChange={(e) => videoStudio.update(project.id, { language: e.target.value })}
                    >
                        {VIDEO_LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.value}>{lang.label}</option>
                        ))}
                    </select>
                </label>
                {/* Not a detail: whisper's CLI assumes English when
                    nothing is set, so a Czech recording left unset comes
                    back as nonsense that still reports success. It also
                    decides what language the script and posts get
                    written in. */}
                <p className="video-studio-hint">
                    Used for the transcript and for whatever KIWI writes about this video. Leave it on detect and it
                    records whatever whisper heard.
                </p>

                <p className="video-studio-hint">
                    A path on the machine running the backend — raw footage is far too large to push through the browser,
                    and the server reads it directly.
                </p>
            </Step>

            <Step n={3} title="Transcript" state={stepState(2)}>
                <div className="video-studio-transcript-status">
                    <span className="video-studio-badge" style={{ color: transcriptMeta.color, borderColor: transcriptMeta.color }}>
                        {transcriptMeta.label}
                    </span>
                    {project.transcriptStatus === "done" && project.transcriptPath && (
                        <code className="video-studio-transcript-path">{project.transcriptPath}</code>
                    )}
                </div>

                {/* The whole point of transcript_error: when it fails you
                    see exactly why, in full, rather than an empty
                    transcript that looks like it just hasn't run. */}
                {project.transcriptStatus === "failed" && project.transcriptError && (
                    <div className="video-studio-error-box">
                        <AlertTriangle size={14} strokeWidth={2} />
                        <span>{project.transcriptError}</span>
                    </div>
                )}

                {project.transcriptStatus === "processing" && (
                    <p className="video-studio-hint">
                        whisper is running locally on the backend — a long recording takes minutes. This updates itself
                        when it finishes.
                    </p>
                )}

                <div className="video-studio-actions">
                    <GatedButton
                        label={project.transcriptStatus === "failed" ? "Try again" : "Transcribe"}
                        icon={project.transcriptStatus === "failed" ? RotateCcw : FileText}
                        onClick={() => videoStudio.transcribe(project.id)}
                        blockedReason={transcribeBlocked}
                        busy={busy === "transcribe"}
                        busyLabel="Starting…"
                        primary
                    />
                </div>
            </Step>

            {/* Always rendered, even with nothing in it — a step that
                appears only once it has content leaves a hole in the
                numbering (3 then 5) and hides where the work goes. */}
            <Step n={4} title="Clips" state={stepState(3)}>
                <div className="video-studio-actions">
                    <GatedButton
                        label={project.clips.length > 0 ? "Find clips again" : "Find clips"}
                        icon={Scissors}
                        onClick={() => videoStudio.findClips(project.id)}
                        blockedReason={clipsBlocked}
                        busy={busy === "clips"}
                        busyLabel="Reading transcript…"
                        primary={project.clips.length === 0}
                    />
                </div>

                {project.clips.length > 0 && (
                    <div className="video-studio-clips">
                        {project.clips.map((clip, i) => {
                            const cutting = busy === "cut" && videoStudio.cuttingIndex === i;
                            return (
                                <div key={`${clip.start}-${i}`} className="video-studio-clip">
                                    <span className="video-studio-clip-time">{formatClock(clip.start)}–{formatClock(clip.end)}</span>
                                    <div className="video-studio-clip-body">
                                        <span className="video-studio-clip-label">{clip.label}</span>
                                        {clip.why && <span className="video-studio-clip-why">{clip.why}</span>}
                                        {/* Once cut, the path IS the
                                            deliverable — the file sits on
                                            the same machine you edit on. */}
                                        {clip.file && <code className="video-studio-clip-file">{clip.file}</code>}
                                    </div>
                                    <button
                                        type="button"
                                        className="video-studio-clip-cut"
                                        onClick={() => videoStudio.cutClip(project.id, i)}
                                        disabled={busy === "cut"}
                                    >
                                        {cutting
                                            ? <><Loader2 size={12} strokeWidth={2} className="video-studio-spin" />Cutting…</>
                                            : <><Film size={12} strokeWidth={2} />{clip.file ? "Cut again" : "Cut"}</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Step>


            <Step n={5} title="Posts and ads" state={stepState(4)}>
                <p className="video-studio-hint">
                    Generated from this video's transcript when there is one, otherwise from its script. They're saved
                    as content items, so they also show up in Content Hub with their own schedule.
                </p>
                <div className="video-studio-actions">
                    {DERIVED_ORDER.map((type) => (
                        <GatedButton
                            key={type}
                            label={DERIVED_META[type].label}
                            icon={DERIVED_META[type].icon}
                            onClick={() => videoStudio.generateContent(project.id, type)}
                            blockedReason={derivedBlocked}
                            busy={busy === "content"}
                            busyLabel="Writing…"
                        />
                    ))}
                </div>
                {derived.length > 0 && (
                    <div className="video-studio-content-list">
                        {derived.map((item) => <ContentItemRow key={item.id} item={item} />)}
                    </div>
                )}
            </Step>
        </div>
    );
}

/**
 * Laboratory's Video Studio — one environment for a video from idea to
 * published, sitting beside Content Hub rather than inside it: a
 * content item is one generated text with a publish lifecycle, whereas
 * a video is a production with a source file, a transcript, and several
 * texts hanging off it (apps/server's video_projects table).
 *
 * List -> detail, same "walk into the thing" shape as Projects and
 * Research here, rather than a drawer over the list.
 *
 * Actions that depend on an earlier step are disabled AND say why, in
 * visible text (see GatedButton). The same conditions are enforced in
 * routes/video.ts — a disabled button is an explanation, not a
 * guarantee.
 */
interface VideoStudioBoardProps {
    videoStudio: VideoStudioState;
    /** Switches the whole Laboratory over to the cut. */
    onOpenEditor: (id: number) => void;
    /**
     * Which video is open, owned by Laboratory.tsx rather than here —
     * the pipeline board sends you straight into one, and two components
     * both holding an opinion about which is open would need syncing.
     * Controlled from above, so there's nothing to sync.
     */
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}

export default function VideoStudioBoard({ videoStudio, selectedId, onSelect, onOpenEditor }: VideoStudioBoardProps) {
    const [newTitle, setNewTitle] = useState("");

    const selected = videoStudio.projects.find((p) => p.id === selectedId) ?? null;

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        if (!newTitle.trim()) return;
        const created = await videoStudio.create(newTitle.trim());
        setNewTitle("");
        if (created) onSelect(created.id);
    };

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Video Studio</h1>
                </div>
                {videoStudio.projects.length > 0 && (
                    <span className="global-board-summary">{videoStudio.projects.length} in production</span>
                )}
            </div>

            {videoStudio.error && (
                <div className={`video-studio-banner${videoStudio.setupNeeded ? " video-studio-banner-setup" : ""}`}>
                    {videoStudio.setupNeeded ? <Info size={14} strokeWidth={2} /> : <AlertTriangle size={14} strokeWidth={2} />}
                    <span>{videoStudio.error}</span>
                    <button type="button" onClick={videoStudio.dismissError} aria-label="Dismiss">×</button>
                </div>
            )}

            {selected ? (
                <VideoDetail
                    project={selected}
                    busy={videoStudio.busy[selected.id]}
                    videoStudio={videoStudio}
                    onBack={() => onSelect(null)}
                    onOpenEditor={() => onOpenEditor(selected.id)}
                />
            ) : (
                <>
                    <form className="video-studio-create" onSubmit={handleCreate}>
                        <input
                            className="video-studio-create-input"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="What's the video? e.g. 3 gear mistakes new hikers make"
                        />
                        <button type="submit" className="video-studio-action-btn video-studio-action-btn-primary" disabled={!newTitle.trim()}>
                            <Plus size={15} strokeWidth={2} />
                            New video
                        </button>
                    </form>

                    {videoStudio.loading ? (
                        <p className="video-studio-hint">Loading…</p>
                    ) : videoStudio.projects.length === 0 ? (
                        <div className="global-board-empty">
                            Nothing in production yet — name a video above and walk it from idea to published.
                        </div>
                    ) : (
                        <div className="video-studio-grid">
                            {videoStudio.projects.map((project) => (
                                <VideoCard key={project.id} project={project} onOpen={() => onSelect(project.id)} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
