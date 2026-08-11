import { useState, type KeyboardEvent } from "react";
import { FileText, Link2, Plus, Trash2 } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface DocumentsBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddDocument: (projectId: string, label: string, url: string) => void;
    onRemoveDocument: (projectId: string, documentId: string) => void;
}

function ProjectDocumentGroup({ project, onSelectProject, onAddDocument, onRemoveDocument }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddDocument: (projectId: string, label: string, url: string) => void;
    onRemoveDocument: (projectId: string, documentId: string) => void;
}) {
    const [newLabel, setNewLabel] = useState("");
    const [newUrl, setNewUrl] = useState("");

    const handleAdd = () => {
        if (!newLabel.trim()) return;
        onAddDocument(project.id, newLabel.trim(), newUrl.trim());
        setNewLabel("");
        setNewUrl("");
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="global-board-group">
            <div className="global-board-group-header">
                <button type="button" className="global-board-group-name" onClick={() => onSelectProject(project.id)}>
                    {project.name}
                </button>
                {project.documents.length > 0 && <span className="global-board-group-count">{project.documents.length}</span>}
            </div>

            {project.documents.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.documents.map((doc) => (
                        <div key={doc.id} className="project-workspace-task">
                            <span className="project-workspace-idea-icon">
                                <FileText size={13} strokeWidth={1.75} />
                            </span>
                            <span className="project-workspace-design-ref">
                                <span className="project-workspace-task-title">{doc.label}</span>
                                {doc.url && (
                                    <a href={doc.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                        <Link2 size={10} strokeWidth={2} />
                                        {doc.url}
                                    </a>
                                )}
                            </span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveDocument(project.id, doc.id)}
                                aria-label="Remove document"
                            >
                                <Trash2 size={13} strokeWidth={1.75} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="project-workspace-task-add project-workspace-design-add">
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Document name..."
                />
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Link (optional)"
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newLabel.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Documents — links out to formal written docs living outside
 * the app (specs, contracts, decks), grouped by project. Distinct from
 * Notes (in-app freeform scratch content) — new per-project state
 * (project.documents), same {label, url} shape as Resources/designRefs.
 */
export default function DocumentsBoard({ projects, onSelectProject, onAddDocument, onRemoveDocument }: DocumentsBoardProps) {
    const totalDocuments = projects.reduce((sum, p) => sum + p.documents.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Documents</h1>
                </div>
                {totalDocuments > 0 && <span className="global-board-summary">{totalDocuments} document{totalDocuments === 1 ? "" : "s"}</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start linking documents.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectDocumentGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddDocument={onAddDocument}
                            onRemoveDocument={onRemoveDocument}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
