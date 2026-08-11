import { useState, type KeyboardEvent } from "react";
import { Link2, Plus, Store, Trash2 } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface StoreBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddStoreChannel: (projectId: string, label: string, url: string) => void;
    onRemoveStoreChannel: (projectId: string, channelId: string) => void;
}

function ProjectStoreGroup({ project, onSelectProject, onAddStoreChannel, onRemoveStoreChannel }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddStoreChannel: (projectId: string, label: string, url: string) => void;
    onRemoveStoreChannel: (projectId: string, channelId: string) => void;
}) {
    const [newLabel, setNewLabel] = useState("");
    const [newUrl, setNewUrl] = useState("");

    const handleAdd = () => {
        if (!newLabel.trim()) return;
        onAddStoreChannel(project.id, newLabel.trim(), newUrl.trim());
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
                {project.storeChannels.length > 0 && <span className="global-board-group-count">{project.storeChannels.length}</span>}
            </div>

            {project.storeChannels.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.storeChannels.map((channel) => (
                        <div key={channel.id} className="project-workspace-task">
                            <span className="project-workspace-idea-icon">
                                <Store size={13} strokeWidth={1.75} />
                            </span>
                            <span className="project-workspace-design-ref">
                                <span className="project-workspace-task-title">{channel.label}</span>
                                {channel.url && (
                                    <a href={channel.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                        <Link2 size={10} strokeWidth={2} />
                                        {channel.url}
                                    </a>
                                )}
                            </span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveStoreChannel(project.id, channel.id)}
                                aria-label="Remove channel"
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
                    placeholder="Channel name (Etsy, App Store...)"
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
 * Global Store — where each project's finished thing is (or will be)
 * sold or distributed, grouped by project. New per-project state
 * (project.storeChannels), same {label, url} shape as Resources —
 * just a tracked list of channels, no real storefront/commerce
 * integration.
 */
export default function StoreBoard({ projects, onSelectProject, onAddStoreChannel, onRemoveStoreChannel }: StoreBoardProps) {
    const totalChannels = projects.reduce((sum, p) => sum + p.storeChannels.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Store</h1>
                </div>
                {totalChannels > 0 && <span className="global-board-summary">{totalChannels} channel{totalChannels === 1 ? "" : "s"}</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start tracking sales channels.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectStoreGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddStoreChannel={onAddStoreChannel}
                            onRemoveStoreChannel={onRemoveStoreChannel}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
