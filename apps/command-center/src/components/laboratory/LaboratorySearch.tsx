import { useEffect, useRef, useState } from "react";
import { FlaskConical, FolderKanban, Search, StickyNote } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import type { LabNote } from "../../state/laboratoryNotes";
import type { ResearchEntry } from "../../state/laboratoryResearch";
import "./LaboratorySearch.css";

type ResultKind = "project" | "note" | "research";

interface SearchResult {
    kind: ResultKind;
    id: string;
    title: string;
    subtitle: string;
}

interface LaboratorySearchProps {
    onClose: () => void;
    projects: LaboratoryProject[];
    notes: LabNote[];
    researchEntries: ResearchEntry[];
    onSelect: (kind: ResultKind, id: string) => void;
}

const KIND_ICON: Record<ResultKind, typeof FolderKanban> = {
    project: FolderKanban,
    note: StickyNote,
    research: FlaskConical,
};

/**
 * A quick cross-section search — Projects/Notes/Research, all client-
 * side (everything's already loaded in Laboratory's own state, no need
 * for a real search index yet). Picking a result switches to that
 * section and opens the item directly, same as clicking it from its
 * own grid.
 */
export default function LaboratorySearch({ onClose, projects, notes, researchEntries, onSelect }: LaboratorySearchProps) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const q = query.trim().toLowerCase();
    const results: SearchResult[] = q
        ? [
            ...projects.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ kind: "project" as const, id: p.id, title: p.name, subtitle: p.category })),
            ...notes.filter((n) => n.title.toLowerCase().includes(q)).map((n) => ({ kind: "note" as const, id: n.id, title: n.title, subtitle: "Note" })),
            ...researchEntries.filter((r) => r.title.toLowerCase().includes(q)).map((r) => ({ kind: "research" as const, id: r.id, title: r.title, subtitle: r.tag || "Research" })),
        ]
        : [];

    return (
        <>
            <div className="lab-search-scrim" onClick={onClose} />
            <div className="lab-search-panel">
                <div className="lab-search-input-row">
                    <Search size={15} strokeWidth={1.75} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="lab-search-input"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search projects, notes, research..."
                    />
                </div>

                {q && (
                    results.length > 0 ? (
                        <div className="lab-search-results">
                            {results.map((r) => {
                                const Icon = KIND_ICON[r.kind];
                                return (
                                    <button
                                        key={`${r.kind}-${r.id}`}
                                        type="button"
                                        className="lab-search-result"
                                        onClick={() => { onSelect(r.kind, r.id); onClose(); }}
                                    >
                                        <Icon size={14} strokeWidth={1.75} />
                                        <span className="lab-search-result-title">{r.title}</span>
                                        <span className="lab-search-result-subtitle">{r.subtitle}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="lab-search-empty">No matches for "{query}".</div>
                    )
                )}
            </div>
        </>
    );
}
