import { useState, type KeyboardEvent } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { MARKETING_STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface MarketingBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddMarketingItem: (projectId: string, label: string) => void;
    onCycleMarketingStatus: (projectId: string, itemId: string) => void;
    onRemoveMarketingItem: (projectId: string, itemId: string) => void;
}

function ProjectMarketingGroup({ project, onSelectProject, onAddMarketingItem, onCycleMarketingStatus, onRemoveMarketingItem }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddMarketingItem: (projectId: string, label: string) => void;
    onCycleMarketingStatus: (projectId: string, itemId: string) => void;
    onRemoveMarketingItem: (projectId: string, itemId: string) => void;
}) {
    const [newLabel, setNewLabel] = useState("");

    const handleAdd = () => {
        if (!newLabel.trim()) return;
        onAddMarketingItem(project.id, newLabel.trim());
        setNewLabel("");
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
                {project.marketing.length > 0 && <span className="global-board-group-count">{project.marketing.length}</span>}
            </div>

            {project.marketing.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.marketing.map((item) => {
                        const statusMeta = MARKETING_STATUS_META[item.status];
                        return (
                            <div key={item.id} className="project-workspace-task">
                                <span className="project-workspace-idea-icon">
                                    <Megaphone size={13} strokeWidth={1.75} />
                                </span>
                                <span className="project-workspace-task-title project-workspace-idea-title">{item.label}</span>
                                <button
                                    type="button"
                                    className="project-workspace-stage-pill"
                                    style={{ color: statusMeta.color, borderColor: statusMeta.color }}
                                    onClick={() => onCycleMarketingStatus(project.id, item.id)}
                                    title="Click to advance status"
                                >
                                    {statusMeta.label}
                                </button>
                                <button
                                    type="button"
                                    className="project-workspace-task-remove"
                                    onClick={() => onRemoveMarketingItem(project.id, item.id)}
                                    aria-label="Remove marketing item"
                                >
                                    <Trash2 size={13} strokeWidth={1.75} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="project-workspace-task-add">
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Add a marketing item for ${project.name}...`}
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newLabel.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Marketing — campaigns/pushes tracked per project, grouped
 * together. Click the status pill to advance planned -> active -> done,
 * same interaction as prototype/product stages. New per-project state
 * (project.marketing), no real channel integrations behind it.
 */
export default function MarketingBoard({ projects, onSelectProject, onAddMarketingItem, onCycleMarketingStatus, onRemoveMarketingItem }: MarketingBoardProps) {
    const totalItems = projects.reduce((sum, p) => sum + p.marketing.length, 0);
    const totalActive = projects.reduce((sum, p) => sum + p.marketing.filter((item) => item.status === "active").length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Marketing</h1>
                </div>
                {totalItems > 0 && <span className="global-board-summary">{totalActive} active · {totalItems} total</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start tracking marketing.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectMarketingGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddMarketingItem={onAddMarketingItem}
                            onCycleMarketingStatus={onCycleMarketingStatus}
                            onRemoveMarketingItem={onRemoveMarketingItem}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
