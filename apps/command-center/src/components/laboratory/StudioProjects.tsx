import { useState, type FormEvent } from "react";
import { AlertTriangle, Clapperboard, Plus } from "lucide-react";
import type { VideoStudioState } from "../../state/videoStudio";
import type { VideoProject } from "../../lib/videoApi";
import { nextAction, stepFor } from "../../state/videoPipeline";
import { formatClock } from "../../lib/timecode";
import "./GlobalBoard.css";
import "./StudioProjects.css";

/** How far along the six stages a video is, as four segments. */
const SEGMENTS = 4;

function ProjectCard({ project, onOpen }: { project: VideoProject; onOpen: () => void }) {
    const step = stepFor(project.stage);
    const failed = project.transcriptStatus === "failed";
    const filled = Math.round((step.step / 6) * SEGMENTS);

    return (
        <button type="button" className={`studio-card${failed ? " studio-card-failed" : ""}`} onClick={onOpen}>
            {/* The frame first: a video library is read by picture, not
                by filename. Nothing has a real thumbnail until it has
                been cut, so an uncut video gets the mark rather than a
                fake still. */}
            <div className={`studio-card-thumb studio-card-thumb-${project.stage}`}>
                <span className="studio-card-stage">{step.label}</span>
                <Clapperboard className="studio-card-mark" size={26} strokeWidth={1.25} />
                {project.clips.length > 0 && (
                    <span className="studio-card-time">{formatClock(project.clips[project.clips.length - 1].end)}</span>
                )}
            </div>

            <div className="studio-card-body">
                <span className="studio-card-title">{project.title}</span>
                <span className="studio-card-next">
                    {failed && <AlertTriangle size={12} strokeWidth={2.5} />}
                    {nextAction(project)}
                </span>
                <div className="studio-card-progress" aria-hidden="true">
                    {Array.from({ length: SEGMENTS }, (_, i) => (
                        <span key={i} className={i < filled ? "studio-card-progress-on" : undefined} />
                    ))}
                </div>
            </div>
        </button>
    );
}

interface StudioProjectsProps {
    videoStudio: VideoStudioState;
    onOpen: (id: number) => void;
}

/**
 * The studio's front door: every video you have, as a card.
 *
 * The vertical pipeline that stood here grouped videos by stage, which
 * answered "what is where" — useful once you have twenty. With a
 * handful it mostly showed empty headings, and the thing you actually
 * want on opening is to see your videos and pick one.
 */
export default function StudioProjects({ videoStudio, onOpen }: StudioProjectsProps) {
    const [title, setTitle] = useState("");
    const failed = videoStudio.projects.filter((p) => p.transcriptStatus === "failed");

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        const created = await videoStudio.create(title.trim());
        setTitle("");
        if (created) onOpen(created.id);
    };

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">KIWI Studio</span>
                    <h1>Your videos</h1>
                </div>
                <form className="studio-new" onSubmit={handleCreate}>
                    <input
                        className="studio-new-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="What's the next video?"
                    />
                    <button type="submit" className="studio-new-btn" disabled={!title.trim()}>
                        <Plus size={15} strokeWidth={2} />
                        New video
                    </button>
                </form>
            </div>

            {failed.length > 0 && (
                <div className="studio-attention">
                    <AlertTriangle size={15} strokeWidth={2} />
                    <span>
                        {failed.map((p) => p.title).join(", ")} — transcription failed.
                    </span>
                </div>
            )}

            {videoStudio.loading ? (
                <p className="studio-muted">Loading…</p>
            ) : videoStudio.projects.length === 0 ? (
                <div className="global-board-empty">Nothing yet. Name a video above and it starts at step one.</div>
            ) : (
                <div className="studio-grid">
                    {videoStudio.projects.map((project) => (
                        <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}
