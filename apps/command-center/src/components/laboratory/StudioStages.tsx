import { FolderKanban } from "lucide-react";
import "./StudioStages.css";

interface StudioOverviewProps {
    /** Whether Projects is the screen you're on. */
    atProjects: boolean;
    onGoToProjects: () => void;
    projectCount: number;
}

/**
 * The top bar's studio control: one button.
 *
 * Projects is the only thing here you can press, because it is the only
 * place there is to go — everything else lives inside a project.
 *
 * The three counts that used to sit beside it are gone. They now live
 * in the overview rail, where they are on every screen instead of
 * competing with the navigation for the top bar's width, and where the
 * same numbers can't be stated twice and drift.
 */
export default function StudioOverview({ atProjects, onGoToProjects, projectCount }: StudioOverviewProps) {
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
        </div>
    );
}
