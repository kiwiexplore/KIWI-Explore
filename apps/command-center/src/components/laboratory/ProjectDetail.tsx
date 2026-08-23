import { useRef, useState, type DragEvent, type FormEvent } from "react";
import {
    AlertTriangle, ArrowRight, Check, ChevronLeft, Clapperboard, Copy, FileText, Film,
    FolderOpen, Image as ImageIcon, Music2, Plus, RefreshCw, Sparkles, Trash2, Upload,
} from "lucide-react";
import type { StudioProjectsState } from "../../state/studioProjects";
import type { StudioProject, ProjectFile } from "../../lib/projectsApi";
import { deleteProjectFile, projectWeight, uploadProjectFile } from "../../lib/projectsApi";
import type { VideoProject } from "../../lib/videoApi";
import type { VideoStudioState } from "../../state/videoStudio";
import { createNote, deleteNote, updateNote } from "../../lib/notesApi";
import { createVideoProject, deleteVideoProject } from "../../lib/videoApi";
import { createContentItem, deleteContentItem, updateContentItem, type ContentItem } from "../../lib/contentApi";
import { chainFor, chainSummary } from "../../state/studioChain";
import GeneratePanel from "./GeneratePanel";
import "./GlobalBoard.css";
import "./ProjectDetail.css";

interface ProjectDetailProps {
    project: StudioProject;
    projects: StudioProjectsState;
    videoStudio: VideoStudioState;
    /** Re-read the studio-wide video list, which the rail counts. */
    onVideosChanged: () => void;
    onBack: () => void;
    onEdit: (videoId: number) => void;
}

/**
 * One project, top to bottom, in the order the work happens.
 *
 * The videos first, because that is the project: what you are making
 * and where each one has got to. Then the material they are made from,
 * and last the text that goes out with them.
 *
 * Every step is a section on this page rather than a screen you get
 * switched into: the whole point of a project is seeing the work
 * together, and publishing was the one part that took the window away
 * to show you a corner of it.
 */
export default function ProjectDetail({
    project, projects, videoStudio, onVideosChanged, onBack, onEdit,
}: ProjectDetailProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { counts } = project;
    const percent = counts.videos === 0
        ? (counts.ideas === 0 ? 0 : Math.round((counts.ideasDone / counts.ideas) * 25))
        : Math.round((counts.published / counts.videos) * 100);

    /** Everything here writes then re-reads: the project carries its own
     *  children, so a change to one has to come back through it. */
    const after = <T,>(work: Promise<T>) => {
        setBusy(true);
        setError(null);
        void work
            .then(() => { projects.refresh(); onVideosChanged(); })
            .catch((e) => setError(e instanceof Error ? e.message : "That didn't work."))
            .finally(() => setBusy(false));
    };

    /**
     * Deleting the project, and optionally its folder.
     *
     * The folder goes to the TRASH, never straight to nothing. This is
     * the only act in the studio that touches footage somebody had to
     * go outside and film, and it has to be the kind of mistake you can
     * take back from Finder.
     *
     * The weight is read from disk first, so the question names what is
     * actually at stake — everything in the folder, Exports included,
     * not the media list on this page.
     */
    const removeProject = async () => {
        // A folder the server can't read still gets offered, just
        // without a size — refusing to let you delete because we
        // couldn't count would be the wrong way round.
        const weight = await projectWeight(project.id).catch(() => null);

        const size = weight && weight.bytes > 0
            ? `${weight.files} ${weight.files === 1 ? "file" : "files"}, ${(weight.bytes / 1_000_000_000).toFixed(2)} GB`
            : "no files";

        const withFolder = confirm(
            `Delete "${project.title}" AND move its folder to the Trash?\n\n`
            + `${project.folder}\n${size}\n\n`
            + "OK — the folder goes to the Trash, where you can put it back from Finder.\n"
            + "Cancel — you'll be asked whether to delete just the project instead.",
        );

        if (!withFolder) {
            const rowOnly = confirm(
                `Delete just the project "${project.title}"?\n\n`
                + "The folder and everything in it stays exactly where it is. "
                + "Its videos and ideas survive too — they simply stop belonging to a project.",
            );
            if (!rowOnly) return;
        }

        try {
            await projects.remove(project.id, withFolder);
            onBack();
        } catch {
            // studioProjects already reported it; staying on the page
            // is the point — the project is still here.
        }
    };

    return (
        <div className="global-board-page">
            <button type="button" className="pd-back" onClick={onBack}>
                <ChevronLeft size={15} strokeWidth={2} />
                All projects
            </button>

            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Project</span>
                    <h1>{project.title}</h1>
                </div>
                <div className="pd-header-right">
                    <div className="pd-progress">
                        <span className="pd-progress-label">{percent}% done</span>
                        <div className="pd-progress-bar"><span style={{ width: `${percent}%` }} /></div>
                    </div>
                    <button type="button" className="pd-delete-project" onClick={() => void removeProject()}>
                        <Trash2 size={13} strokeWidth={2} />
                        Delete project
                    </button>
                </div>
            </div>

            {error && (
                <div className="pd-error">
                    <AlertTriangle size={14} strokeWidth={2} />
                    <span>{error}</span>
                </div>
            )}

            {/* First, because it is the answer to "how is this project
                going" — the list of what you are making and where each
                one has got to. Everything below it is material for
                these, and reads as such once they are at the top. */}
            <VideosPanel project={project} busy={busy} after={after} onEdit={onEdit} />
            <FootagePanel project={project} projects={projects} />
            <ScriptsPanel project={project} busy={busy} after={after} />
            <IdeasPanel project={project} busy={busy} after={after} />
            {/* Lands a file in the same folder as the footage, so the
                list above refreshes when one finishes. */}
            <GeneratePanel projectId={project.id} onFilesChanged={projects.refresh} />
            <PublishPanel project={project} videoStudio={videoStudio} after={after} />
        </div>
    );
}

/* ── ideas ──────────────────────────────────────────────────────────── */

function IdeasPanel({ project, busy, after }: {
    project: StudioProject;
    busy: boolean;
    after: <T>(work: Promise<T>) => void;
}) {
    const [idea, setIdea] = useState("");
    const { counts } = project;

    const addIdea = (event: FormEvent) => {
        event.preventDefault();
        if (!idea.trim()) return;
        after(createNote("idea", idea.trim(), project.id));
        setIdea("");
    };

    return (
        <section className="pd-panel">
            <div className="pd-panel-head">
                <h2>Ideas</h2>
                <span className="pd-count">{counts.ideasDone}/{counts.ideas}</span>
            </div>

            <form className="pd-add" onSubmit={addIdea}>
                <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Something this project could be…" />
                <button type="submit" disabled={!idea.trim() || busy}><Plus size={14} strokeWidth={2} /></button>
            </form>

            {project.notes.length === 0 ? (
                <p className="pd-muted">Nothing written down yet.</p>
            ) : (
                <div className="pd-ideas">
                    {project.notes.map((note) => (
                        <div key={note.id} className={`pd-idea${note.done ? " pd-idea-done" : ""}`}>
                            {/* The tick is the point: an idea list you
                                can't work through is just a list. */}
                            <button
                                type="button"
                                className="pd-tick"
                                onClick={() => after(updateNote(note.id, { done: !note.done }))}
                                aria-label={note.done ? "Mark as not done" : "Mark as done"}
                            >
                                {note.done && <Check size={12} strokeWidth={3.5} />}
                            </button>
                            <span className="pd-idea-title">{note.title}</span>
                            <button
                                type="button"
                                className="pd-idea-remove"
                                onClick={() => after(deleteNote(note.id))}
                                aria-label="Remove"
                            >
                                <Trash2 size={13} strokeWidth={1.75} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

/* ── scripts ────────────────────────────────────────────────────────── */

/**
 * Scripts, written by either of you.
 *
 * They used to be read-only: the only way to get one was to ask KIWI,
 * and the only thing you could do with the answer was look at it. A
 * draft is a starting point, not a delivery — so this is a text box you
 * can type in, and you can start one from nothing.
 */
function ScriptsPanel({ project, busy, after }: {
    project: StudioProject;
    busy: boolean;
    after: <T>(work: Promise<T>) => void;
}) {
    const [title, setTitle] = useState("");

    const scripts = project.videos.flatMap((v) =>
        v.contentItems.filter((i) => i.type === "youtube-script").map((item) => ({ video: v.title, item })));

    const write = (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        // Attached to a video only when there is exactly one obvious
        // owner. Guessing between three would file it under the wrong
        // one, and a script under the wrong video is a script you lose.
        const only = project.videos.length === 1 ? project.videos[0].id : undefined;
        after(createContentItem("youtube-script", title.trim(), "", only));
        setTitle("");
    };

    return (
        <section className="pd-panel">
            <div className="pd-panel-head">
                <h2>Scripts</h2>
                <span className="pd-count">{scripts.length}</span>
            </div>

            <form className="pd-add" onSubmit={write}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Start a script — what is it about?" />
                <button type="submit" disabled={!title.trim() || busy}><Plus size={14} strokeWidth={2} /></button>
            </form>

            {scripts.length === 0 ? (
                <p className="pd-muted">
                    Nothing written yet. Start one above, or open a video and ask KIWI to draft it.
                </p>
            ) : (
                <div className="pd-scripts">
                    {scripts.map(({ video, item }) => <ScriptRow key={item.id} video={video} item={item} after={after} />)}
                </div>
            )}
        </section>
    );
}

function ScriptRow({ video, item, after }: {
    video: string;
    item: ContentItem;
    after: <T>(work: Promise<T>) => void;
}) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(item.content);
    const [saved, setSaved] = useState(true);

    const save = () => {
        setSaved(true);
        after(updateContentItem(item.id, { content: text }));
    };

    return (
        <div className="pd-script">
            <div className="pd-script-head">
                <button type="button" className="pd-script-open" onClick={() => setOpen((o) => !o)}>
                    <FileText size={13} strokeWidth={1.75} />
                    <span className="pd-script-video">{item.topic}</span>
                    <span className="pd-script-for">for {video}</span>
                </button>
                <button
                    type="button"
                    className="pd-icon-btn"
                    onClick={() => { if (confirm(`Delete the script "${item.topic}"?`)) after(deleteContentItem(item.id)); }}
                    aria-label="Delete this script"
                >
                    <Trash2 size={13} strokeWidth={1.75} />
                </button>
            </div>

            {open && (
                <div className="pd-script-body">
                    <textarea
                        value={text}
                        onChange={(e) => { setText(e.target.value); setSaved(false); }}
                        onBlur={() => { if (!saved) save(); }}
                        placeholder="Write it here, or ask KIWI to draft one from the video."
                        rows={12}
                    />
                    <div className="pd-script-foot">
                        <span className="pd-muted">{saved ? "Saved" : "Unsaved — click away, or press Save"}</span>
                        <button type="button" className="pd-small-btn" onClick={save} disabled={saved}>Save</button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── footage ────────────────────────────────────────────────────────── */

const KIND_ICON = { video: Film, audio: Music2, image: ImageIcon };

/**
 * The material, and the only place it comes from.
 *
 * This was called Media and sat apart from the videos, which made it
 * read as a separate feature rather than the input to one. It is the
 * project's folder on disk: drop a file here or copy it in from Finder
 * and it is the same file, under the same name, in the same place. The
 * editor's bin IS this list.
 */
function FootagePanel({ project, projects }: { project: StudioProject; projects: StudioProjectsState }) {
    const [over, setOver] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const picker = useRef<HTMLInputElement>(null);

    const send = async (files: FileList | File[]) => {
        setError(null);
        // One at a time rather than all at once: these are whole video
        // files, and a dozen concurrent uploads of a gigabyte each is
        // how a local server starts refusing connections.
        for (const file of Array.from(files)) {
            setUploading(file.name);
            try {
                await uploadProjectFile(project.id, file);
            } catch (e) {
                setError(e instanceof Error ? e.message : `Could not add ${file.name}`);
            }
        }
        setUploading(null);
        projects.refresh();
    };

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        if (event.dataTransfer.files.length > 0) void send(event.dataTransfer.files);
    };

    const remove = (file: ProjectFile) => {
        const ok = confirm(
            `Delete ${file.name} from the project's folder?\n\n`
            + "This removes the file from your disk. Any cut that uses it will stop finding it.",
        );
        if (!ok) return;
        void deleteProjectFile(project.id, file.name)
            .then(() => projects.refresh())
            .catch((e) => setError(e instanceof Error ? e.message : "Could not delete that file."));
    };

    return (
        <section className="pd-panel">
            <div className="pd-panel-head">
                <h2>Footage</h2>
                <span className="pd-count">{project.files.length}</span>
                <span className="pd-panel-note">video, music and stills you cut from</span>
                <button type="button" className="pd-refresh" onClick={() => projects.refresh()} aria-label="Re-read the folder">
                    <RefreshCw size={13} strokeWidth={2} />
                </button>
            </div>

            <div
                className={`pd-drop${over ? " pd-drop-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                onClick={() => picker.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") picker.current?.click(); }}
            >
                <Upload size={17} strokeWidth={1.75} />
                <span className="pd-drop-main">
                    {uploading ? `Adding ${uploading}…` : "Drop video, music or stills here"}
                </span>
                <span className="pd-drop-sub">or click to pick them — they land in this project's folder</span>
                <input
                    ref={picker}
                    type="file"
                    multiple
                    accept="video/*,audio/*,image/*"
                    onChange={(e) => { if (e.target.files) void send(e.target.files); e.target.value = ""; }}
                    hidden
                />
            </div>

            {error && <p className="pd-file-error">{error}</p>}

            {/* The folder is the point: a real place on your disk, and
                nothing here is copied into the app. */}
            <div className="pd-folder">
                <FolderOpen size={14} strokeWidth={1.75} />
                <code>{project.folder || "No folder yet"}</code>
            </div>

            {project.files.length === 0 ? (
                <p className="pd-muted">Empty. Drop something above and it's in the project.</p>
            ) : (
                <div className="pd-files">
                    {project.files.map((file) => {
                        const Icon = KIND_ICON[file.kind];
                        return (
                            <div key={file.name} className="pd-file">
                                <Icon size={13} strokeWidth={1.75} />
                                <span className="pd-file-name">{file.name}</span>
                                <span className="pd-file-size">{(file.bytes / 1_000_000).toFixed(1)} MB</span>
                                <button
                                    type="button"
                                    className="pd-icon-btn"
                                    onClick={() => remove(file)}
                                    aria-label={`Delete ${file.name}`}
                                >
                                    <Trash2 size={12} strokeWidth={1.75} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

/* ── videos ─────────────────────────────────────────────────────────── */

/**
 * The videos you are making — which is not the same list as the footage
 * below, and that difference is what was confusing.
 *
 * A file is material. A video here is one finished thing you are
 * working towards: it has its own cut, its own transcript and its own
 * posts. Several can be cut out of the same footage, which is exactly
 * why the two lists cannot be one.
 */
function VideosPanel({ project, busy, after, onEdit }: {
    project: StudioProject;
    busy: boolean;
    after: <T>(work: Promise<T>) => void;
    onEdit: (id: number) => void;
}) {
    const [videoTitle, setVideoTitle] = useState("");
    const { counts } = project;

    const addVideo = (event: FormEvent) => {
        event.preventDefault();
        if (!videoTitle.trim()) return;
        after(createVideoProject(videoTitle.trim(), undefined, project.id));
        setVideoTitle("");
    };

    return (
        <section className="pd-panel">
            <div className="pd-panel-head">
                <h2>Videos</h2>
                <span className="pd-count">{counts.published}/{counts.videos} published</span>
                <span className="pd-panel-note">what you're making, and where each one has got to</span>
            </div>

            <form className="pd-add" onSubmit={addVideo}>
                <input
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="What are you making? — e.g. Episode 3, the sump"
                />
                <button type="submit" disabled={!videoTitle.trim() || busy}><Plus size={14} strokeWidth={2} /></button>
            </form>

            {project.videos.length === 0 ? (
                <p className="pd-muted">Nothing being made yet.</p>
            ) : (
                <div className="pd-videos">
                    {project.videos.map((video) => (
                        <VideoRow
                            key={video.id}
                            video={video}
                            onEdit={() => onEdit(video.id)}
                            onDelete={() => {
                                const ok = confirm(
                                    `Delete "${video.title}"?\n\n`
                                    + "The footage in the project's folder stays. The cut, the transcript and the "
                                    + "text written for it go.",
                                );
                                if (ok) after(deleteVideoProject(video.id));
                            }}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

/**
 * One video and where it actually is.
 *
 * The chain replaces the single stage label that used to sit here. A
 * label says what somebody set; the chain says what has been done —
 * and, on the step that hasn't, what is missing.
 */
function VideoRow({ video, onEdit, onDelete }: {
    video: VideoProject;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const failed = video.transcriptStatus === "failed";
    const chain = chainFor(video);

    return (
        <div className={`pd-video${failed ? " pd-video-failed" : ""}`}>
            <div className="pd-video-mark pd-video-mark-shot">
                <Clapperboard size={15} strokeWidth={1.75} />
            </div>
            <div className="pd-video-body">
                <span className="pd-video-title">
                    <span className="pd-video-name">{video.title}</span>
                </span>
                <span className="pd-video-next">
                    {failed && <AlertTriangle size={11} strokeWidth={2.5} />}
                    {chainSummary(video)}
                </span>
            </div>

            <div className="pd-chain" aria-label={`${chain.done} of ${chain.total} done`}>
                {chain.steps.map((step, i) => (
                    <span key={step.stage} className="pd-chain-cell">
                        {i > 0 && <span className="pd-chain-link" />}
                        <span
                            className={
                                "pd-chain-step" + (
                                    step.done ? " pd-chain-done"
                                        : step === chain.current ? " pd-chain-now" : ""
                                )
                            }
                            title={step.blocker ?? `${step.label} — done`}
                        >
                            {step.label}
                        </span>
                    </span>
                ))}
            </div>

            <div className="pd-video-actions">
                <button type="button" onClick={onEdit}>Edit<ArrowRight size={12} strokeWidth={2} /></button>
                <button type="button" className="pd-icon-btn" onClick={onDelete} aria-label={`Delete ${video.title}`}>
                    <Trash2 size={13} strokeWidth={1.75} />
                </button>
            </div>
        </div>
    );
}

/* ── publish ────────────────────────────────────────────────────────── */

const PIECES: { type: ContentItem["type"]; label: string; placeholder: string }[] = [
    { type: "youtube-script", label: "YouTube", placeholder: "Title, description, chapters…" },
    { type: "instagram-post", label: "Instagram", placeholder: "Caption and hashtags…" },
    { type: "tiktok-post", label: "TikTok", placeholder: "Caption…" },
    { type: "ad", label: "Ad", placeholder: "The paid version of the pitch…" },
];

/**
 * What goes out with the video, on the same page as the video.
 *
 * This used to be a screen you were switched into, which took the whole
 * project away to show you one corner of it. It is a section now, at
 * the bottom, where the work ends up.
 *
 * Nothing is posted anywhere. KIWI writes, you edit it, you copy it,
 * and you upload it yourself — which is also why this needs no account,
 * no token and no permission from anybody.
 */
function PublishPanel({ project, videoStudio, after }: {
    project: StudioProject;
    videoStudio: VideoStudioState;
    after: <T>(work: Promise<T>) => void;
}) {
    const [openId, setOpenId] = useState<number | null>(null);
    // Falls back to the first video rather than storing it, so deleting
    // the selected one can't leave this pointing at nothing.
    const video = project.videos.find((v) => v.id === openId) ?? project.videos[0] ?? null;

    return (
        <section className="pd-panel">
            <div className="pd-panel-head">
                <h2>Publish</h2>
                <span className="pd-panel-note">written here, posted by you — nothing leaves this machine on its own</span>
            </div>

            {/* An empty project used to make this section disappear
                entirely, which reads as a missing feature rather than as
                nothing to show. The text here is written FOR a video, so
                with no videos there is genuinely nothing to write — and
                saying that is the whole job. */}
            {!video && (
                <p className="pd-muted">
                    Nothing to write yet. These texts are written for one video — add one at the top of the page
                    and its titles, description and posts appear here.
                </p>
            )}

            {video && project.videos.length > 1 && (
                <div className="pd-pub-tabs">
                    {project.videos.map((v) => (
                        <button
                            key={v.id}
                            type="button"
                            className={`pd-pub-tab${v.id === video.id ? " pd-pub-tab-on" : ""}`}
                            onClick={() => setOpenId(v.id)}
                        >
                            {v.title}
                            {v.stage === "published" && <Check size={11} strokeWidth={3} />}
                        </button>
                    ))}
                </div>
            )}

            {video && (
                <>
                    <div className="pd-pub-state">
                        <span className={video.exported ? "pd-pub-ok" : "pd-pub-wait"}>
                            {video.exported ? "Export is on disk, in Exports/" : "Nothing exported yet — cut it first"}
                        </span>
                        <span className="pd-pub-spacer" />
                        <button
                            type="button"
                            className={`pd-small-btn${video.stage === "published" ? " pd-small-btn-on" : ""}`}
                            onClick={() => {
                                void videoStudio
                                    .update(video.id, { stage: video.stage === "published" ? "editing" : "published" })
                                    .then(() => after(Promise.resolve()));
                            }}
                        >
                            {video.stage === "published" ? "Published ✓" : "Mark as published"}
                        </button>
                    </div>

                    <div className="pd-pieces">
                        {PIECES.map((piece) => (
                            <PieceCard
                                key={`${video.id}-${piece.type}`}
                                piece={piece}
                                video={video}
                                busy={videoStudio.busy[video.id] === "content" || videoStudio.busy[video.id] === "script"}
                                onGenerate={() => {
                                    if (piece.type === "youtube-script") videoStudio.draftScript(video.id, "");
                                    else videoStudio.generateContent(video.id, piece.type as "ad" | "instagram-post" | "tiktok-post");
                                }}
                                after={after}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

function PieceCard({ piece, video, busy, onGenerate, after }: {
    piece: (typeof PIECES)[number];
    video: VideoProject;
    busy: boolean;
    onGenerate: () => void;
    after: <T>(work: Promise<T>) => void;
}) {
    const existing = video.contentItems.find((i) => i.type === piece.type) ?? null;
    const [text, setText] = useState("");
    const [dirty, setDirty] = useState(false);
    const [copied, setCopied] = useState(false);

    // A piece that arrives while this card is open replaces what is in
    // the box — unless you have typed into it, in which case yours wins.
    // Generation you asked for before you started typing must not throw
    // away what you wrote after.
    const shown = dirty ? text : (existing?.content ?? "");

    const save = () => {
        setDirty(false);
        if (existing) after(updateContentItem(existing.id, { content: text }));
        else after(createContentItem(piece.type, video.title, text, video.id));
    };

    const copy = () => {
        void navigator.clipboard.writeText(shown).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        });
    };

    return (
        <div className="pd-piece">
            <div className="pd-piece-head">
                <h3>{piece.label}</h3>
                <span className="pd-pub-spacer" />
                <button type="button" className="pd-small-btn" onClick={onGenerate} disabled={busy}>
                    <Sparkles size={11} strokeWidth={2} />
                    {busy ? "Writing…" : existing ? "Rewrite" : "Generate"}
                </button>
                <button
                    type="button"
                    className="pd-icon-btn"
                    onClick={copy}
                    disabled={!shown}
                    aria-label={`Copy the ${piece.label} text`}
                >
                    {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} strokeWidth={1.75} />}
                </button>
                {existing && (
                    <button
                        type="button"
                        className="pd-icon-btn"
                        onClick={() => { if (confirm(`Delete the ${piece.label} text?`)) after(deleteContentItem(existing.id)); }}
                        aria-label={`Delete the ${piece.label} text`}
                    >
                        <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                )}
            </div>

            <textarea
                value={shown}
                onChange={(e) => { setText(e.target.value); setDirty(true); }}
                onBlur={() => { if (dirty) save(); }}
                placeholder={piece.placeholder}
                rows={7}
            />

            {dirty && <span className="pd-muted pd-piece-hint">Unsaved — click away to keep it</span>}
        </div>
    );
}
