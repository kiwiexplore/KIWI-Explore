import { useState, type FormEvent } from "react";
import {
    AlertTriangle, ArrowRight, Check, ChevronLeft, Clapperboard, FileText, Film,
    FolderOpen, Music2, Plus, RefreshCw, Send, Sparkles, Trash2, Video,
} from "lucide-react";
import type { StudioProjectsState } from "../../state/studioProjects";
import type { StudioProject } from "../../lib/projectsApi";
import type { VideoProject, VideoTrack } from "../../lib/videoApi";
import { createNote, deleteNote, updateNote } from "../../lib/notesApi";
import { createVideoProject } from "../../lib/videoApi";
import { chainFor, chainSummary } from "../../state/studioChain";
import type { ContentItem } from "../../lib/contentApi";
import "./GlobalBoard.css";
import "./ProjectDetail.css";

interface ProjectDetailProps {
    project: StudioProject;
    projects: StudioProjectsState;
    /** Re-read the studio-wide video list, which the top bar counts. */
    onVideosChanged: () => void;
    onBack: () => void;
    onEdit: (videoId: number) => void;
    onPublish: (videoId: number) => void;
}

/**
 * One project, with everything in it.
 *
 * Ideas at the top because that is where a video comes from, videos
 * below because that is what the ideas become. Both live on one page
 * rather than behind tabs: the whole point of a project is seeing the
 * work together, and a tab is a place to hide half of it.
 */
export default function ProjectDetail({ project, projects, onVideosChanged, onBack, onEdit, onPublish }: ProjectDetailProps) {
    const [idea, setIdea] = useState("");
    const [videoTitle, setVideoTitle] = useState("");
    // The one question worth asking before a video exists, because it
    // decides whether the chain has a generation step in it at all.
    const [track, setTrack] = useState<VideoTrack>("shot");
    const [busy, setBusy] = useState(false);

    const { counts } = project;
    const percent = counts.videos === 0
        ? (counts.ideas === 0 ? 0 : Math.round((counts.ideasDone / counts.ideas) * 25))
        : Math.round((counts.published / counts.videos) * 100);

    /** Everything here writes then re-reads: the project carries its own
     *  children, so a change to one has to come back through it. */
    const after = <T,>(work: Promise<T>) => {
        setBusy(true);
        void work
            .then(() => { projects.refresh(); onVideosChanged(); })
            .finally(() => setBusy(false));
    };

    const addIdea = (event: FormEvent) => {
        event.preventDefault();
        if (!idea.trim()) return;
        after(createNote("idea", idea.trim(), project.id));
        setIdea("");
    };

    // Every script the AI has written for any video in this project.
    // Kept in one place because a script is a thing you go back and
    // read, and hunting through videos for it is how it gets lost.
    const scripts: { video: string; item: ContentItem }[] = project.videos.flatMap((v) =>
        v.contentItems.filter((i) => i.type === "youtube-script").map((item) => ({ video: v.title, item })));

    const addVideo = (event: FormEvent) => {
        event.preventDefault();
        if (!videoTitle.trim()) return;
        after(createVideoProject(videoTitle.trim(), undefined, project.id, track));
        setVideoTitle("");
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
                <div className="pd-progress">
                    <span className="pd-progress-label">{percent}% done</span>
                    <div className="pd-progress-bar"><span style={{ width: `${percent}%` }} /></div>
                </div>
            </div>

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

            <section className="pd-panel">
                <div className="pd-panel-head">
                    <h2>Scripts</h2>
                    <span className="pd-count">{scripts.length}</span>
                </div>
                {scripts.length === 0 ? (
                    <p className="pd-muted">
                        Nothing written yet. Open a video and ask KIWI to draft one — it lands here.
                    </p>
                ) : (
                    <div className="pd-scripts">
                        {scripts.map(({ video, item }) => <ScriptRow key={item.id} video={video} item={item} />)}
                    </div>
                )}
            </section>

            <section className="pd-panel">
                <div className="pd-panel-head">
                    <h2>Media</h2>
                    <span className="pd-count">{project.files.length}</span>
                    <button type="button" className="pd-refresh" onClick={() => projects.refresh()} aria-label="Re-read the folder">
                        <RefreshCw size={13} strokeWidth={2} />
                    </button>
                </div>
                {/* The folder is the point: put files here from Finder
                    and they are in the project. Nothing is copied and
                    nothing is uploaded — which is also why moving them
                    afterwards breaks it, exactly as it would anywhere
                    else. */}
                <div className="pd-folder">
                    <FolderOpen size={14} strokeWidth={1.75} />
                    <code>{project.folder || "No folder yet"}</code>
                </div>
                {project.files.length === 0 ? (
                    <p className="pd-muted">Empty. Drop your footage into that folder and press refresh.</p>
                ) : (
                    <div className="pd-files">
                        {project.files.map((file) => (
                            <div key={file.name} className="pd-file">
                                {file.kind === "audio"
                                    ? <Music2 size={13} strokeWidth={1.75} />
                                    : <Film size={13} strokeWidth={1.75} />}
                                <span className="pd-file-name">{file.name}</span>
                                <span className="pd-file-size">{(file.bytes / 1_000_000).toFixed(1)} MB</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="pd-panel">
                <div className="pd-panel-head">
                    <h2>Videos</h2>
                    <span className="pd-count">{counts.published}/{counts.videos} published</span>
                </div>

                {/* Which track BEFORE the title, because it is the one
                    thing that can't be changed later without the chain
                    underneath the video changing with it. Two buttons
                    rather than a dropdown: there are exactly two, and a
                    dropdown would hide the one you aren't on. */}
                <div className="pd-track-pick" role="radiogroup" aria-label="How this video gets made">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={track === "ai"}
                        className={`pd-track-opt pd-track-opt-ai${track === "ai" ? " pd-track-opt-on" : ""}`}
                        onClick={() => setTrack("ai")}
                    >
                        <Sparkles size={14} strokeWidth={2} />
                        <span className="pd-track-name">Generate it with AI</span>
                        <span className="pd-track-why">Script first, then the pictures come from it.</span>
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={track === "shot"}
                        className={`pd-track-opt pd-track-opt-shot${track === "shot" ? " pd-track-opt-on" : ""}`}
                        onClick={() => setTrack("shot")}
                    >
                        <Video size={14} strokeWidth={2} />
                        <span className="pd-track-name">Edit footage I shot</span>
                        <span className="pd-track-why">The material is already in this folder.</span>
                    </button>
                </div>

                <form className="pd-add" onSubmit={addVideo}>
                    <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="A video in this project…" />
                    <button type="submit" disabled={!videoTitle.trim() || busy}><Plus size={14} strokeWidth={2} /></button>
                </form>

                {project.videos.length === 0 ? (
                    <p className="pd-muted">No videos yet.</p>
                ) : (
                    <div className="pd-videos">
                        {project.videos.map((video) => (
                            <VideoRow
                                key={video.id}
                                video={video}
                                owner={project}
                                onEdit={() => onEdit(video.id)}
                                onPublish={() => onPublish(video.id)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function ScriptRow({ video, item }: { video: string; item: ContentItem }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="pd-script">
            <button type="button" onClick={() => setOpen((o) => !o)}>
                <FileText size={13} strokeWidth={1.75} />
                <span className="pd-script-video">{video}</span>
                <span className="pd-script-status">{item.status}</span>
            </button>
            {open && <pre>{item.content}</pre>}
        </div>
    );
}

/**
 * One video and where it actually is.
 *
 * The chain replaces the single stage label that used to sit here. A
 * label says what somebody set; the chain says what has been done —
 * and, on the step that hasn't, what is missing. That is the difference
 * between a video you have to open to understand and one you don't.
 */
function VideoRow({ video, owner, onEdit, onPublish }: {
    video: VideoProject;
    owner: StudioProject;
    onEdit: () => void;
    onPublish: () => void;
}) {
    const failed = video.transcriptStatus === "failed";
    const chain = chainFor(video, owner);

    return (
        <div className={`pd-video${failed ? " pd-video-failed" : ""}`}>
            <div className={`pd-video-mark pd-video-mark-${video.track}`}>
                {video.track === "ai"
                    ? <Sparkles size={15} strokeWidth={1.75} />
                    : <Clapperboard size={15} strokeWidth={1.75} />}
            </div>
            <div className="pd-video-body">
                <span className="pd-video-title">
                    <span className="pd-video-name">{video.title}</span>
                    <span className={`pd-track pd-track-${video.track}`}>{video.track === "ai" ? "AI" : "Shot"}</span>
                </span>
                <span className="pd-video-next">
                    {failed && <AlertTriangle size={11} strokeWidth={2.5} />}
                    {chainSummary(video, owner)}
                </span>
            </div>

            <div className="pd-chain" aria-label={`${chain.done} of ${chain.total} done`}>
                {chain.steps.map((step, i) => (
                    <span key={step.stage} className="pd-chain-cell">
                        {i > 0 && <span className="pd-chain-link" />}
                        <span
                            className={
                                // A step that doesn't apply is only ever
                                // struck through. It counts as satisfied
                                // so the chain can move past it, but
                                // painting it green would claim work
                                // that was never done.
                                "pd-chain-step" + (
                                    !step.applies ? " pd-chain-na"
                                        : step.done ? " pd-chain-done"
                                            : step === chain.current ? " pd-chain-now" : ""
                                )
                            }
                            // The step that isn't done says why, right
                            // where you are pointing at it.
                            title={step.applies ? (step.blocker ?? `${step.label} — done`) : `${step.label} — not needed for footage you shot`}
                        >
                            {step.label}
                        </span>
                    </span>
                ))}
            </div>

            <div className="pd-video-actions">
                <button type="button" onClick={onEdit}>Edit<ArrowRight size={12} strokeWidth={2} /></button>
                <button type="button" onClick={onPublish}><Send size={12} strokeWidth={2} />Publish</button>
            </div>
        </div>
    );
}
