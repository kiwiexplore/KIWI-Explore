import { Plus, Link2, FlaskConical } from "lucide-react";
import type { ResearchEntry } from "../../state/laboratoryResearch";
import "./ResearchGrid.css";

interface ResearchGridProps {
    entries: ResearchEntry[];
    onSelectEntry: (id: string) => void;
    onCreateEntry: () => void;
}

export default function ResearchGrid({ entries, onSelectEntry, onCreateEntry }: ResearchGridProps) {
    return (
        <div className="research-grid-page">
            <div className="research-grid-header">
                <div>
                    <span className="research-grid-eyebrow">Laboratory</span>
                    <h1>Research</h1>
                </div>
                <button type="button" className="research-grid-new" onClick={onCreateEntry}>
                    <Plus size={16} strokeWidth={2} />
                    Save Finding
                </button>
            </div>

            {entries.length === 0 ? (
                <div className="research-grid-empty">Nothing saved yet — save your first finding above.</div>
            ) : (
                <div className="research-grid">
                    {entries.map((entry) => (
                        <button key={entry.id} type="button" className="research-card" onClick={() => onSelectEntry(entry.id)}>
                            <div className="research-card-top">
                                <FlaskConical size={15} strokeWidth={1.75} className="research-card-icon" />
                                {entry.tag && <span className="research-card-tag">{entry.tag}</span>}
                            </div>
                            <h3 className="research-card-title">{entry.title}</h3>
                            <p className="research-card-summary">{entry.summary || "No summary yet."}</p>
                            <div className="research-card-footer">
                                {entry.source && (
                                    <span className="research-card-source">
                                        <Link2 size={11} strokeWidth={2} />
                                        {entry.source}
                                    </span>
                                )}
                                <span className="research-card-saved">{entry.savedAt}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
