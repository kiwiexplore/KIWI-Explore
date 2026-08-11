import { useState, type KeyboardEvent } from "react";
import { Link2, Palette, Plus, Trash2 } from "lucide-react";
import type { LaboratoryProject, ImageAttachment } from "../../state/laboratoryProjects";
import { ImageUploadButton, ImageThumbnail } from "./ImageAttachmentField";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface DesignStudioBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddDesignRef: (projectId: string, label: string, url: string, image?: ImageAttachment) => void;
    onRemoveDesignRef: (projectId: string, refId: string) => void;
}

function ProjectDesignGroup({ project, onSelectProject, onAddDesignRef, onRemoveDesignRef }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddDesignRef: (projectId: string, label: string, url: string, image?: ImageAttachment) => void;
    onRemoveDesignRef: (projectId: string, refId: string) => void;
}) {
    const [newLabel, setNewLabel] = useState("");
    const [newUrl, setNewUrl] = useState("");

    const handleAdd = () => {
        if (!newLabel.trim()) return;
        onAddDesignRef(project.id, newLabel.trim(), newUrl.trim());
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
                {project.designRefs.length > 0 && <span className="global-board-group-count">{project.designRefs.length}</span>}
            </div>

            {project.designRefs.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.designRefs.map((ref) => (
                        <div key={ref.id} className="project-workspace-task">
                            {ref.image ? (
                                <ImageThumbnail image={ref.image} alt={ref.label} />
                            ) : (
                                <span className="project-workspace-idea-icon">
                                    <Palette size={13} strokeWidth={1.75} />
                                </span>
                            )}
                            <span className="project-workspace-design-ref">
                                <span className="project-workspace-task-title">{ref.label}</span>
                                {ref.url && (
                                    <a href={ref.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                        <Link2 size={10} strokeWidth={2} />
                                        {ref.url}
                                    </a>
                                )}
                            </span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveDesignRef(project.id, ref.id)}
                                aria-label="Remove reference"
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
                    placeholder="Reference name..."
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
                <ImageUploadButton
                    onUpload={(file, image) => onAddDesignRef(project.id, file.name, "", image)}
                    label="Upload"
                />
            </div>
        </div>
    );
}

/**
 * Global Design Studio — every project's design references in one
 * place, grouped by project. Reuses project.designRefs (same data the
 * per-project workspace's Design module already tracks).
 */
export default function DesignStudioBoard({ projects, onSelectProject, onAddDesignRef, onRemoveDesignRef }: DesignStudioBoardProps) {
    const totalRefs = projects.reduce((sum, p) => sum + p.designRefs.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Design Studio</h1>
                </div>
                {totalRefs > 0 && <span className="global-board-summary">{totalRefs} reference{totalRefs === 1 ? "" : "s"}</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start collecting references.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectDesignGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddDesignRef={onAddDesignRef}
                            onRemoveDesignRef={onRemoveDesignRef}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
