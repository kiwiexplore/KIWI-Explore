import { useState, type KeyboardEvent } from "react";
import { Info, Plus, Radar, Trash2 } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface TrendScannerBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddTrendTopic: (projectId: string, topic: string) => void;
    onRemoveTrendTopic: (projectId: string, topicId: string) => void;
}

function ProjectTrendTopicGroup({ project, onSelectProject, onAddTrendTopic, onRemoveTrendTopic }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddTrendTopic: (projectId: string, topic: string) => void;
    onRemoveTrendTopic: (projectId: string, topicId: string) => void;
}) {
    const [newTopic, setNewTopic] = useState("");

    const handleAdd = () => {
        if (!newTopic.trim()) return;
        onAddTrendTopic(project.id, newTopic.trim());
        setNewTopic("");
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
                {project.trendTopics.length > 0 && <span className="global-board-group-count">{project.trendTopics.length}</span>}
            </div>

            {project.trendTopics.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.trendTopics.map((item) => (
                        <div key={item.id} className="project-workspace-task">
                            <span className="project-workspace-idea-icon">
                                <Radar size={13} strokeWidth={1.75} />
                            </span>
                            <span className="project-workspace-task-title project-workspace-idea-title">{item.topic}</span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveTrendTopic(project.id, item.id)}
                                aria-label="Remove topic"
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
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Watch a topic for ${project.name}...`}
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newTopic.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Trend Scanner — a watch-list of topics per project, grouped
 * together. Same honesty as the other AI Tools boards: adding a topic
 * just tracks it in project.trendTopics, nothing is actually scanned
 * or monitored yet.
 */
export default function TrendScannerBoard({ projects, onSelectProject, onAddTrendTopic, onRemoveTrendTopic }: TrendScannerBoardProps) {
    const totalTopics = projects.reduce((sum, p) => sum + p.trendTopics.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Trend Scanner</h1>
                </div>
                {totalTopics > 0 && <span className="global-board-summary">{totalTopics} watched</span>}
            </div>

            <div className="global-board-notice">
                <Info size={14} strokeWidth={2} />
                <span>Not connected to a live model yet — topics saved here are tracked for later, not monitored.</span>
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start watching topics.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectTrendTopicGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddTrendTopic={onAddTrendTopic}
                            onRemoveTrendTopic={onRemoveTrendTopic}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
