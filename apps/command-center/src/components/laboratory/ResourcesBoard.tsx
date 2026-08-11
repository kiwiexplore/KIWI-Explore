import { useState, type KeyboardEvent } from "react";
import { Library, Link2, Plus, Trash2 } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface ResourcesBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddResource: (projectId: string, label: string, url: string) => void;
    onRemoveResource: (projectId: string, resourceId: string) => void;
}

function ProjectResourceGroup({ project, onSelectProject, onAddResource, onRemoveResource }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddResource: (projectId: string, label: string, url: string) => void;
    onRemoveResource: (projectId: string, resourceId: string) => void;
}) {
    const [newLabel, setNewLabel] = useState("");
    const [newUrl, setNewUrl] = useState("");

    const handleAdd = () => {
        if (!newLabel.trim()) return;
        onAddResource(project.id, newLabel.trim(), newUrl.trim());
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
                {project.resources.length > 0 && <span className="global-board-group-count">{project.resources.length}</span>}
            </div>

            {project.resources.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.resources.map((resource) => (
                        <div key={resource.id} className="project-workspace-task">
                            <span className="project-workspace-idea-icon">
                                <Library size={13} strokeWidth={1.75} />
                            </span>
                            <span className="project-workspace-design-ref">
                                <span className="project-workspace-task-title">{resource.label}</span>
                                {resource.url && (
                                    <a href={resource.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                        <Link2 size={10} strokeWidth={2} />
                                        {resource.url}
                                    </a>
                                )}
                            </span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveResource(project.id, resource.id)}
                                aria-label="Remove resource"
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
                    placeholder="Resource name..."
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
 * Global Resources — links out to things a project depends on (docs, a
 * library, a tool) but doesn't own, grouped by project. New per-project
 * state (project.resources), same {label, url} shape and add/remove
 * flow as designRefs/prototypes.
 */
export default function ResourcesBoard({ projects, onSelectProject, onAddResource, onRemoveResource }: ResourcesBoardProps) {
    const totalResources = projects.reduce((sum, p) => sum + p.resources.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Resources</h1>
                </div>
                {totalResources > 0 && <span className="global-board-summary">{totalResources} link{totalResources === 1 ? "" : "s"}</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start tracking resources.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectResourceGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddResource={onAddResource}
                            onRemoveResource={onRemoveResource}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
