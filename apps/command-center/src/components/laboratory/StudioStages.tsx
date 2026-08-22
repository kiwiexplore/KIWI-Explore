import { Clapperboard, FolderKanban, Send, Wand2 } from "lucide-react";
import "./StudioStages.css";

export type StudioStage = "projects" | "create" | "edit" | "publish";

const STAGES: { id: StudioStage; label: string; icon: typeof FolderKanban }[] = [
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "create", label: "Create", icon: Wand2 },
    { id: "edit", label: "Edit", icon: Clapperboard },
    { id: "publish", label: "Publish", icon: Send },
];

interface StudioStagesProps {
    active: StudioStage;
    /** Whether a video is picked — the last three need one. */
    hasVideo: boolean;
    /** Folded into the stages they belong to, not listed separately. */
    videoCount: number;
    publishedCount: number;
    onGo: (stage: StudioStage) => void;
}

/**
 * The studio's spine, living in the top bar: Projects → Create → Edit →
 * Publish, always there and always clickable.
 *
 * It began as a strip under the top bar on three of the four screens,
 * which meant it vanished exactly where it was most useful — inside the
 * editor, the one place you can lose track of where you are. Up here it
 * is present on every screen, including the full-window cut.
 *
 * The counts that used to sit in their own pill are folded into the
 * stages they describe rather than listed beside them: "how many
 * videos" is a fact about Projects, and "how many published" is a fact
 * about Publish. Two controls saying overlapping things is what this
 * replaces.
 *
 * Stages behind the one you're on go green because they are behind
 * you, not because anything was verified — this is a map, not a
 * scoreboard.
 */
export default function StudioStages({ active, hasVideo, videoCount, publishedCount, onGo }: StudioStagesProps) {
    const index = STAGES.findIndex((s) => s.id === active);

    return (
        <nav className="studio-stages" aria-label="Studio stages">
            {STAGES.map((stage, i) => {
                const state = i === index ? "active" : i < index ? "done" : "ahead";
                const reachable = stage.id === "projects" || hasVideo;
                const count = stage.id === "projects" ? videoCount
                    : stage.id === "publish" ? publishedCount
                        : null;
                return (
                    <div key={stage.id} className="studio-stages-item">
                        {i > 0 && (
                            <svg className="studio-stages-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        )}
                        <button
                            type="button"
                            className={`studio-stage studio-stage-${state}`}
                            onClick={() => onGo(stage.id)}
                            disabled={!reachable}
                            title={reachable ? undefined : "Pick a video first"}
                            aria-current={i === index ? "step" : undefined}
                        >
                            <stage.icon size={13} strokeWidth={2} />
                            {stage.label}
                            {/* Zero is worth showing on Projects — it's
                                the state you start in — but a zero next
                                to Publish is just noise. */}
                            {count !== null && (count > 0 || stage.id === "projects") && (
                                <span className="studio-stage-count">{count}</span>
                            )}
                        </button>
                    </div>
                );
            })}
        </nav>
    );
}
