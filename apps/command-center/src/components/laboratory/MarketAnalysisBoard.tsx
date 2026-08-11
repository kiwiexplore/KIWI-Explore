import { useState, type KeyboardEvent } from "react";
import { Info, Plus, Trash2, TrendingUp } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface MarketAnalysisBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddMarketQuery: (projectId: string, query: string) => void;
    onRemoveMarketQuery: (projectId: string, queryId: string) => void;
}

function ProjectMarketQueryGroup({ project, onSelectProject, onAddMarketQuery, onRemoveMarketQuery }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddMarketQuery: (projectId: string, query: string) => void;
    onRemoveMarketQuery: (projectId: string, queryId: string) => void;
}) {
    const [newQuery, setNewQuery] = useState("");

    const handleAdd = () => {
        if (!newQuery.trim()) return;
        onAddMarketQuery(project.id, newQuery.trim());
        setNewQuery("");
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
                {project.marketQueries.length > 0 && <span className="global-board-group-count">{project.marketQueries.length}</span>}
            </div>

            {project.marketQueries.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.marketQueries.map((item) => (
                        <div key={item.id} className="project-workspace-task">
                            <span className="project-workspace-idea-icon">
                                <TrendingUp size={13} strokeWidth={1.75} />
                            </span>
                            <span className="project-workspace-task-title project-workspace-idea-title">{item.query}</span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveMarketQuery(project.id, item.id)}
                                aria-label="Remove query"
                            >
                                <Trash2 size={13} strokeWidth={1.75} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="project-workspace-task-add">
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newQuery}
                    onChange={(e) => setNewQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Save a market question for ${project.name}...`}
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newQuery.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Market Analysis — a research-question log per project,
 * grouped together. Same honesty as ImageGenerationBoard: saving a
 * query just tracks it in project.marketQueries, nothing actually
 * analyzes anything yet.
 */
export default function MarketAnalysisBoard({ projects, onSelectProject, onAddMarketQuery, onRemoveMarketQuery }: MarketAnalysisBoardProps) {
    const totalQueries = projects.reduce((sum, p) => sum + p.marketQueries.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Market Analysis</h1>
                </div>
                {totalQueries > 0 && <span className="global-board-summary">{totalQueries} saved</span>}
            </div>

            <div className="global-board-notice">
                <Info size={14} strokeWidth={2} />
                <span>Not connected to a live model yet — questions saved here are tracked for later, not answered.</span>
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start saving questions.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectMarketQueryGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddMarketQuery={onAddMarketQuery}
                            onRemoveMarketQuery={onRemoveMarketQuery}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
