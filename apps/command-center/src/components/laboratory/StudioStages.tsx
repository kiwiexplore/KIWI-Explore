import { Clapperboard, FolderKanban, Send, Wand2 } from "lucide-react";
import type { VideoProject } from "../../lib/videoApi";
import "./StudioStages.css";

export type StudioStage = "projects" | "create" | "edit" | "publish";

const STAGES: { id: StudioStage; label: string; icon: typeof FolderKanban }[] = [
    { id: "projects", label: "PROJECTS", icon: FolderKanban },
    { id: "create", label: "CREATE", icon: Wand2 },
    { id: "edit", label: "EDIT", icon: Clapperboard },
    { id: "publish", label: "PUBLISH", icon: Send },
];

interface StudioStagesProps {
    active: StudioStage;
    /** Null on PROJECTS, where no one video is being followed. */
    project: VideoProject | null;
    onGo: (stage: StudioStage) => void;
}

/**
 * The spine: PROJECTS → CREATE → EDIT → PUBLISH.
 *
 * Stages behind the one you're on go green, because they are behind you
 * — not because anything was verified. The strip is a map of where you
 * are, and pretending to grade the work would make it a scoreboard.
 *
 * Everything stays clickable. A person who wants to look at PUBLISH on
 * day one is allowed to; the order is how the work usually goes, not a
 * rule about how it must.
 */
export default function StudioStages({ active, project, onGo }: StudioStagesProps) {
    const index = STAGES.findIndex((s) => s.id === active);

    return (
        <nav className="studio-stages" aria-label="Studio stages">
            {STAGES.map((stage, i) => {
                const state = i === index ? "active" : i < index ? "done" : "ahead";
                // Every stage past PROJECTS is about one video, so
                // without one there is nothing for them to open.
                const reachable = stage.id === "projects" || project !== null;
                return (
                    <div key={stage.id} className="studio-stages-item">
                        {i > 0 && (
                            <svg className="studio-stages-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        )}
                        <button
                            type="button"
                            className={`studio-stage studio-stage-${state}`}
                            onClick={() => onGo(stage.id)}
                            disabled={!reachable}
                            aria-current={i === index ? "step" : undefined}
                        >
                            <stage.icon size={14} strokeWidth={2} />
                            {stage.label}
                        </button>
                    </div>
                );
            })}

            {project && <span className="studio-stages-subject">{project.title}</span>}
        </nav>
    );
}
