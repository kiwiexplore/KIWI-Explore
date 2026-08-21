import "./LaboratoryStats.css";

interface LaboratoryStatsProps {
    videoCount: number;
    inProgressCount: number;
    publishedCount: number;
    failedCount: number;
}

/**
 * The top bar's at-a-glance line. It used to count projects, notes and
 * findings — the Laboratory's old generic vocabulary — which said
 * nothing about the work actually happening here. It now counts videos,
 * so the bar answers "how's the pipeline" rather than "how many notes
 * exist".
 *
 * Failures get their own slot and only appear when there are any: a
 * zero there would be noise, but a non-zero one is the single most
 * important number on this bar.
 */
export default function LaboratoryStats({ videoCount, inProgressCount, publishedCount, failedCount }: LaboratoryStatsProps) {
    return (
        <div className="lab-stats">
            <span className="lab-stats-item"><strong>{videoCount}</strong> Videos</span>
            <span className="lab-stats-divider" />
            <span className="lab-stats-item"><strong>{inProgressCount}</strong> In progress</span>
            <span className="lab-stats-divider" />
            <span className="lab-stats-item"><strong>{publishedCount}</strong> Published</span>
            {failedCount > 0 && (
                <>
                    <span className="lab-stats-divider" />
                    <span className="lab-stats-item lab-stats-item-alert"><strong>{failedCount}</strong> Needs you</span>
                </>
            )}
        </div>
    );
}
