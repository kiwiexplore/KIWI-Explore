import { useState, type FormEvent } from "react";
import {
    AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2,
} from "lucide-react";
import type { StudioProjectsState } from "../../state/studioProjects";
import type { StudioProject } from "../../lib/projectsApi";
import { projectWeight } from "../../lib/projectsApi";
import type { VideoProject } from "../../lib/videoApi";
import { createVideoProject, deleteVideoProject } from "../../lib/videoApi";
import type { VideoStudioState } from "../../state/videoStudio";
import { chainFor, chainSummary } from "../../state/studioChain";
import VideoWorkspace from "./VideoWorkspace";
import EditableText from "./EditableText";
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
 * One project: what it is, and the videos in it.
 *
 * The page used to be seven sections side by side — ideas, scripts,
 * footage, videos, thumbnails, publish — which read as seven equal
 * things when only one of them is what a project actually contains.
 * Everything else is about A VIDEO, so everything else now lives
 * inside one: click a video open and its footage, script, cut,
 * thumbnails and posts unfold under it.
 *
 * That also settles a question the flat page kept asking and never
 * answering: what belongs to what. Nothing can be filed under the wrong
 * video when the only way to reach it is through the right one.
 */
export default function ProjectDetail({
    project, projects, videoStudio, onVideosChanged, onBack, onEdit,
}: ProjectDetailProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoTitle, setVideoTitle] = useState("");
    const [openId, setOpenId] = useState<number | null>(null);

    const { counts } = project;
    const percent = counts.videos === 0 ? 0 : Math.round((counts.published / counts.videos) * 100);

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

    const addVideo = (event: FormEvent) => {
        event.preventDefault();
        if (!videoTitle.trim()) return;
        after(createVideoProject(videoTitle.trim(), undefined, project.id));
        setVideoTitle("");
    };

    /**
     * Deleting the project, and everything in it.
     *
     * Everything now means everything: its videos, their cuts, their
     * scripts and posts go with it, because a video that outlived its
     * project had nowhere to appear. The folder goes to the TRASH, never
     * straight to nothing — this is the only act in the studio that
     * touches footage somebody had to go outside and film, and it has to
     * be the kind of mistake you can take back from Finder.
     */
    const removeProject = async () => {
        // A folder the server can't count is still offered, just without
        // a size. Refusing to delete because we couldn't measure would
        // be the wrong way round.
        const weight = await projectWeight(project.id).catch(() => null);
        const size = weight && weight.bytes > 0
            ? `${weight.files} ${weight.files === 1 ? "file" : "files"}, ${(weight.bytes / 1_000_000_000).toFixed(2)} GB`
            : "no files";
        const videos = counts.videos === 1 ? "1 video" : `${counts.videos} videos`;

        const withFolder = confirm(
            `Delete "${project.title}" AND move its folder to the Trash?\n\n`
            + `${project.folder}\n${size}\n\n`
            + `${videos} go with it, along with their cuts, scripts and posts.\n\n`
            + "OK — the folder goes to the Trash, where you can put it back from Finder.\n"
            + "Cancel — you'll be asked whether to delete just the project instead.",
        );

        if (!withFolder) {
            const rowOnly = confirm(
                `Delete "${project.title}" but leave the folder alone?\n\n`
                + `${videos} and everything written for them go. The footage in\n${project.folder}\nstays exactly where it is.`,
            );
            if (!rowOnly) return;
        }

        try {
            await projects.remove(project.id, withFolder);
            onBack();
        } catch {
            // studioProjects already reported it; staying put is the
            // point — the project is still here.
        }
    };

    return (
        <div className="global-board-page">
            <button type="button" className="pd-back" onClick={onBack}>
                <ChevronLeft size={15} strokeWidth={2} />
                All projects
            </button>

            <div className="pd-head">
                <div className="pd-head-main">
                    <span className="global-board-eyebrow">Project</span>
                    {/* The name is editable in place. A project called
                        "asdasd" because you were in a hurry is the
                        normal case, and having to delete and remake it
                        to fix that is absurd. */}
                    <EditableText
                        className="pd-title"
                        value={project.title}
                        placeholder="Name this project"
                        onSave={(title) => projects.update(project.id, { title })}
                    />
                    <EditableText
                        className="pd-desc"
                        value={project.description}
                        placeholder="What is this project about? — a series, a channel run, one film…"
                        multiline
                        onSave={(description) => projects.update(project.id, { description })}
                    />
                </div>
                <div className="pd-head-right">
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

            <section className="pd-panel">
                <div className="pd-panel-head">
                    <h2>Videos</h2>
                    <span className="pd-count">{counts.published}/{counts.videos} published</span>
                    <span className="pd-panel-note">open one to work on it</span>
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
                            <VideoBlock
                                key={video.id}
                                video={video}
                                project={project}
                                projects={projects}
                                videoStudio={videoStudio}
                                open={openId === video.id}
                                onToggle={() => setOpenId((was) => (was === video.id ? null : video.id))}
                                onEdit={() => onEdit(video.id)}
                                after={after}
                                onDelete={() => {
                                    const ok = confirm(
                                        `Delete "${video.title}"?\n\n`
                                        + "Its cut, transcript and everything written for it go. The footage in "
                                        + "the project's folder stays.",
                                    );
                                    if (ok) after(deleteVideoProject(video.id));
                                }}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

/**
 * One video: the row you scan, and everything about it underneath.
 *
 * Collapsed it is a title, where the work has got to, and the chain.
 * Open it is the whole job. Only one is open at a time — a project with
 * four videos all unfolded is the flat page again with extra steps.
 */
function VideoBlock({ video, project, projects, videoStudio, open, onToggle, onEdit, onDelete, after }: {
    video: VideoProject;
    project: StudioProject;
    projects: StudioProjectsState;
    videoStudio: VideoStudioState;
    open: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    after: <T>(work: Promise<T>) => void;
}) {
    // The jobs are read inside the workspace, which is where they are
    // polled. Until it has been opened the chain reads an empty list —
    // it says "make a thumbnail", which is right for a video nobody has
    // opened yet.
    const [jobs, setJobs] = useState<Parameters<typeof chainFor>[0]["jobs"]>([]);
    const chain = chainFor({ video, jobs });
    const failed = video.transcriptStatus === "failed";

    return (
        <div className={`pd-video-block${open ? " pd-video-block-open" : ""}`}>
            <div className={`pd-video${failed ? " pd-video-failed" : ""}`}>
                <button type="button" className="pd-video-open" onClick={onToggle} aria-expanded={open}>
                    {open
                        ? <ChevronDown size={15} strokeWidth={2} />
                        : <ChevronRight size={15} strokeWidth={2} />}
                </button>

                <div className="pd-video-body">
                    <span className="pd-video-title">
                        <span className="pd-video-name">{video.title}</span>
                    </span>
                    <span className="pd-video-next">
                        {failed && <AlertTriangle size={11} strokeWidth={2.5} />}
                        {chainSummary({ video, jobs })}
                    </span>
                </div>

                <div className="pd-chain" aria-label={`${chain.done} of ${chain.total} done`}>
                    {chain.steps.map((step, i) => (
                        <span key={step.stage} className="pd-chain-cell">
                            {i > 0 && <span className="pd-chain-link" />}
                            <span
                                className={`pd-chain-step pd-chain-${step.state}`}
                                title={step.next ?? `${step.label} — done`}
                            >
                                {step.label}
                            </span>
                        </span>
                    ))}
                </div>

                <div className="pd-video-actions">
                    <button type="button" className="pd-icon-btn" onClick={onDelete} aria-label={`Delete ${video.title}`}>
                        <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                </div>
            </div>

            {open && (
                <VideoWorkspace
                    video={video}
                    project={project}
                    projects={projects}
                    videoStudio={videoStudio}
                    onEdit={onEdit}
                    onJobs={setJobs}
                    after={after}
                />
            )}
        </div>
    );
}
