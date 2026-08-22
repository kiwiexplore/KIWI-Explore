import { useState, type FormEvent } from "react";
import {
    AlertTriangle, ArrowRight, Check, ChevronLeft, Clapperboard, FileText, Film,
    FolderOpen, Music2, Plus, RefreshCw, Send, Trash2,
} from "lucide-react";
import type { StudioProjectsState } from "../../state/studioProjects";
import type { StudioProject } from "../../lib/projectsApi";
import type { VideoProject } from "../../lib/videoApi";
import { createNote, deleteNote, updateNote } from "../../lib/notesApi";
import { createVideoProject } from "../../lib/videoApi";
import { nextAction, stepFor } from "../../state/videoPipeline";
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
        after(createVideoProject(videoTitle.trim(), undefined, project.id));
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

                <form className="pd-add" onSubmit={addVideo}>
                    <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="A video in this project…" />
                    <button type="submit" disabled={!videoTitle.trim() || busy}><Plus size={14} strokeWidth={2} /></button>
                </form>

                {project.videos.length === 0 ? (
                    <p className="pd-muted">No videos yet.</p>
                ) : (
                    <div className="pd-videos">
                        {project.videos.map((video) => (
                            <VideoRow key={video.id} video={video} onEdit={() => onEdit(video.id)} onPublish={() => onPublish(video.id)} />
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

function VideoRow({ video, onEdit, onPublish }: { video: VideoProject; onEdit: () => void; onPublish: () => void }) {
    const step = stepFor(video.stage);
    const failed = video.transcriptStatus === "failed";

    return (
        <div className={`pd-video${failed ? " pd-video-failed" : ""}`}>
            <div className={`pd-video-mark pd-video-mark-${video.stage}`}>
                <Clapperboard size={15} strokeWidth={1.75} />
            </div>
            <div className="pd-video-body">
                <span className="pd-video-title">{video.title}</span>
                <span className="pd-video-next">
                    {failed && <AlertTriangle size={11} strokeWidth={2.5} />}
                    {nextAction(video)}
                </span>
            </div>
            <span className="pd-video-stage">{step.label}</span>
            <div className="pd-video-actions">
                <button type="button" onClick={onEdit}>Edit<ArrowRight size={12} strokeWidth={2} /></button>
                <button type="button" onClick={onPublish}><Send size={12} strokeWidth={2} />Publish</button>
            </div>
        </div>
    );
}
