import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, Clapperboard, Lightbulb, Plus, Radar } from "lucide-react";
import type { VideoStudioState } from "../../state/videoStudio";
import type { LabNotesState } from "../../state/labNotes";
import type { LabNote } from "../../lib/notesApi";
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

function Band({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
    return (
        <section className="studio-band">
            <div className="studio-band-head">
                <h2>{title}</h2>
                {count !== undefined && <span className="studio-band-count">{count}</span>}
            </div>
            {children}
        </section>
    );
}

interface StudioProjectsProps {
    videoStudio: VideoStudioState;
    labNotes: LabNotesState;
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
/**
 * The studio's home, in bands ordered by urgency rather than by date.
 *
 * A flat grid of everything answers "what do I have", which is the
 * least useful question on opening: what you want to know is what is
 * broken, what is half-finished, what to start next, and what is done.
 *
 * Each band disappears when it is empty. A home screen showing the same
 * headings with nothing under most of them is a template, not a status.
 */
export default function StudioProjects({ videoStudio, labNotes, onOpen }: StudioProjectsProps) {
    const [title, setTitle] = useState("");

    const failed = videoStudio.projects.filter((p) => p.transcriptStatus === "failed");
    const inFlight = videoStudio.projects.filter((p) => p.stage !== "published" && p.transcriptStatus !== "failed");
    const published = videoStudio.projects.filter((p) => p.stage === "published");

    // Ideas and trends nothing has been made from yet. This is what
    // source_note_id was for: a video that remembers what it came out
    // of, recorded when it starts rather than reconstructed later.
    const used = new Set(videoStudio.projects.map((p) => p.sourceNoteId).filter((id): id is number => id !== null));
    const seeds = labNotes.notes
        .filter((n) => (n.kind === "idea" || n.kind === "trend") && !used.has(n.id))
        .slice(0, 6);

    const startFrom = (note: LabNote) => {
        void videoStudio.create(note.title, note.id).then((created) => {
            if (created) onOpen(created.id);
        });
    };

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        const created = await videoStudio.create(title.trim());
        setTitle("");
        if (created) onOpen(created.id);
    };

    const nothing = videoStudio.projects.length === 0 && seeds.length === 0;

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

            {videoStudio.loading ? (
                <p className="studio-muted">Loading…</p>
            ) : nothing ? (
                <div className="global-board-empty">
                    Nothing yet. Name a video above, or write an idea down in the rail and start one from it.
                </div>
            ) : (
                <>
                    {/* Failures first and by name — the only thing here
                        that will not fix itself by being left alone. */}
                    {failed.length > 0 && (
                        <Band title="Needs you" count={failed.length}>
                            <div className="studio-grid">
                                {failed.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />)}
                            </div>
                        </Band>
                    )}

                    {inFlight.length > 0 && (
                        <Band title="In flight" count={inFlight.length}>
                            <div className="studio-grid">
                                {inFlight.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />)}
                            </div>
                        </Band>
                    )}

                    {seeds.length > 0 && (
                        <Band title="Start from something you wrote down">
                            <div className="studio-seeds">
                                {seeds.map((note) => (
                                    <button key={note.id} type="button" className="studio-seed" onClick={() => startFrom(note)}>
                                        {note.kind === "trend"
                                            ? <Radar size={14} strokeWidth={1.75} />
                                            : <Lightbulb size={14} strokeWidth={1.75} />}
                                        <span className="studio-seed-title">{note.title}</span>
                                        <ArrowRight className="studio-seed-arrow" size={14} strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        </Band>
                    )}

                    {published.length > 0 && (
                        <Band title="Published" count={published.length}>
                            <div className="studio-grid">
                                {published.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />)}
                            </div>
                        </Band>
                    )}
                </>
            )}
        </div>
    );
}
