import { ArrowLeft } from "lucide-react";
import type { ResearchEntry } from "../../state/laboratoryResearch";
import "./ResearchDetail.css";

interface ResearchDetailProps {
    entry: ResearchEntry;
    onBack: () => void;
    onChange: (id: string, changes: Partial<Pick<ResearchEntry, "title" | "summary" | "tag" | "source">>) => void;
}

/**
 * Editing a finding just updates it in place in Laboratory's own state
 * as you type (no explicit save step) — same mock philosophy as
 * NoteEditor/ProjectWorkspace.
 */
export default function ResearchDetail({ entry, onBack, onChange }: ResearchDetailProps) {
    return (
        <div className="research-detail">
            <button type="button" className="research-detail-back" onClick={onBack}>
                <ArrowLeft size={14} strokeWidth={2} />
                Research
            </button>

            <input
                type="text"
                className="research-detail-title"
                value={entry.title}
                onChange={(e) => onChange(entry.id, { title: e.target.value })}
                placeholder="Untitled finding"
            />

            <div className="research-detail-meta">
                <input
                    type="text"
                    className="research-detail-tag"
                    value={entry.tag}
                    onChange={(e) => onChange(entry.id, { tag: e.target.value })}
                    placeholder="Tag (e.g. Materials)"
                />
                <input
                    type="text"
                    className="research-detail-source"
                    value={entry.source}
                    onChange={(e) => onChange(entry.id, { source: e.target.value })}
                    placeholder="Source URL or citation (optional)"
                />
            </div>

            <textarea
                className="research-detail-summary"
                value={entry.summary}
                onChange={(e) => onChange(entry.id, { summary: e.target.value })}
                placeholder="What did you find?"
            />
        </div>
    );
}
