import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, Check, Plus } from "lucide-react";
import type { VideoStudioState } from "../../state/videoStudio";
import type { VideoProject } from "../../lib/videoApi";
import { PIPELINE, groupByStage, needsAttention, nextAction } from "../../state/videoPipeline";
import "./GlobalBoard.css";
import "./LaboratoryGuide.css";

interface LaboratoryGuideProps {
    videoStudio: VideoStudioState;
    /** Opens Video Studio with this video already selected. */
    onOpenVideo: (id: number) => void;
}

function VideoCard({ project, onOpen }: { project: VideoProject; onOpen: () => void }) {
    const failed = project.transcriptStatus === "failed";
    return (
        <button type="button" className={`lab-guide-card${failed ? " lab-guide-card-failed" : ""}`} onClick={onOpen}>
            <span className="lab-guide-card-title">{project.title}</span>
            <span className="lab-guide-card-next">
                {failed && <AlertTriangle size={12} strokeWidth={2.5} />}
                {nextAction(project)}
            </span>
            <ArrowRight className="lab-guide-card-arrow" size={14} strokeWidth={2} />
        </button>
    );
}

/**
 * The Laboratory's front door, arranged around the only thing it's for:
 * getting a video made.
 *
 * Every video you have, sitting under the step it's actually waiting on
 * — the six stages that live in video_projects.stage, not a second
 * invented set. Each card says the one next thing to do, so the whole
 * board can be read without opening anything.
 *
 * Empty steps stay visible but collapse to a single dim line: seeing the
 * shape of the whole pipeline is the point, and hiding the empty parts
 * would make the road disappear as you walk it.
 */
export default function LaboratoryGuide({ videoStudio, onOpenVideo }: LaboratoryGuideProps) {
    const [title, setTitle] = useState("");
    const groups = groupByStage(videoStudio.projects);
    const attention = needsAttention(videoStudio.projects);

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        const created = await videoStudio.create(title.trim());
        setTitle("");
        if (created) onOpenVideo(created.id);
    };

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Your videos</h1>
                </div>
                {videoStudio.projects.length > 0 && (
                    <span className="global-board-summary">{videoStudio.projects.length} in the pipeline</span>
                )}
            </div>

            <form className="lab-guide-new" onSubmit={handleCreate}>
                <input
                    className="lab-guide-new-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What's the next video? e.g. 3 gear mistakes new hikers make"
                />
                <button type="submit" className="lab-guide-new-btn" disabled={!title.trim()}>
                    <Plus size={15} strokeWidth={2} />
                    Start it
                </button>
            </form>

            {/* Failures come first and by name. A transcript that died is
                the one thing here that won't fix itself by waiting. */}
            {attention.length > 0 && (
                <div className="lab-guide-attention">
                    <AlertTriangle size={15} strokeWidth={2} />
                    <div>
                        <strong>{attention.length === 1 ? "One video needs you" : `${attention.length} videos need you`}</strong>
                        <span>{attention.map((p) => p.title).join(", ")} — transcription failed.</span>
                    </div>
                </div>
            )}

            {videoStudio.loading ? (
                <p className="lab-guide-muted">Loading…</p>
            ) : videoStudio.projects.length === 0 ? (
                <div className="lab-guide-empty">
                    <p>Nothing in the pipeline. Name a video above and it'll appear at step 1.</p>
                    <ol className="lab-guide-preview">
                        {PIPELINE.map((s) => (
                            <li key={s.stage}><span>{s.step}</span>{s.label}</li>
                        ))}
                    </ol>
                </div>
            ) : (
                <ol className="lab-guide-pipeline">
                    {groups.map(({ step, videos }) => (
                        <li key={step.stage} className={`lab-guide-step${videos.length === 0 ? " lab-guide-step-empty" : ""}`}>
                            <div className="lab-guide-step-head">
                                <span className="lab-guide-step-num">
                                    {step.stage === "published" && videos.length > 0
                                        ? <Check size={11} strokeWidth={3.5} />
                                        : step.step}
                                </span>
                                <h3>{step.label}</h3>
                                {videos.length > 0 && <span className="lab-guide-step-count">{videos.length}</span>}
                                <span className="lab-guide-step-todo">{step.todo}</span>
                            </div>

                            {videos.length > 0 && (
                                <div className="lab-guide-step-cards">
                                    {videos.map((project) => (
                                        <VideoCard key={project.id} project={project} onOpen={() => onOpenVideo(project.id)} />
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
