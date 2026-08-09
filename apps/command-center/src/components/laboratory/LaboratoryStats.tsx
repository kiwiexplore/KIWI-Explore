import "./LaboratoryStats.css";

interface LaboratoryStatsProps {
    projectCount: number;
    activeProjectCount: number;
    noteCount: number;
    researchCount: number;
}

/**
 * Sits where the top bar's own Projects/Research/Notes nav tabs used
 * to be — those duplicated the left sidebar's own items with nothing
 * extra to offer, per explicit feedback, so this shows an at-a-glance
 * summary instead (same three lists Laboratory already tracks, no new
 * data needed).
 */
export default function LaboratoryStats({ projectCount, activeProjectCount, noteCount, researchCount }: LaboratoryStatsProps) {
    return (
        <div className="lab-stats">
            <span className="lab-stats-item"><strong>{projectCount}</strong> Projects</span>
            <span className="lab-stats-divider" />
            <span className="lab-stats-item"><strong>{activeProjectCount}</strong> Active</span>
            <span className="lab-stats-divider" />
            <span className="lab-stats-item"><strong>{noteCount}</strong> Notes</span>
            <span className="lab-stats-divider" />
            <span className="lab-stats-item"><strong>{researchCount}</strong> Findings</span>
        </div>
    );
}
