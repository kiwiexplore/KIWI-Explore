import { FolderKanban } from "lucide-react";
import "./StudioStages.css";

interface StudioOverviewProps {
    /** Whether Projects is the screen you're on. */
    atProjects: boolean;
    onGoToProjects: () => void;
    projectCount: number;
    videoCount: number;
    inProgressCount: number;
    publishedCount: number;
    failedCount: number;
}

/**
 * The top bar's overview: one button and a read-out.
 *
 * Projects is the only thing here you can press, because it is the only
 * place there is to go — everything else lives inside a project. The
 * four stages that used to sit here were navigation to screens that no
 * longer exist on their own, and three of them were unreachable
 * without a video picked anyway.
 *
 * The rest is what you currently have, at a glance and not clickable:
 * numbers that answer "where am I" without pretending to be a menu.
 */
export default function StudioOverview({
    atProjects, onGoToProjects, projectCount, videoCount, inProgressCount, publishedCount, failedCount,
}: StudioOverviewProps) {
    return (
        <div className="studio-overview">
            <button
                type="button"
                className={`studio-overview-go${atProjects ? " studio-overview-go-active" : ""}`}
                onClick={onGoToProjects}
                aria-current={atProjects ? "page" : undefined}
            >
                <FolderKanban size={14} strokeWidth={2} />
                Projects
                <span className="studio-overview-badge">{projectCount}</span>
            </button>

            <span className="studio-overview-divider" />

            <span className="studio-overview-stat"><strong>{videoCount}</strong> videos</span>
            <span className="studio-overview-divider" />
            <span className="studio-overview-stat"><strong>{inProgressCount}</strong> in progress</span>
            <span className="studio-overview-divider" />
            <span className="studio-overview-stat"><strong>{publishedCount}</strong> published</span>

            {/* Only when there is one. A zero here would be a number
                claiming your attention for nothing. */}
            {failedCount > 0 && (
                <>
                    <span className="studio-overview-divider" />
                    <span className="studio-overview-stat studio-overview-alert">
                        <strong>{failedCount}</strong> needs you
                    </span>
                </>
            )}
        </div>
    );
}
