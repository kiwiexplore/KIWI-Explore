import { useState, type KeyboardEvent } from "react";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface IdeasBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddIdea: (projectId: string, text: string) => void;
    onRemoveIdea: (projectId: string, ideaId: string) => void;
}

function ProjectIdeaGroup({ project, onSelectProject, onAddIdea, onRemoveIdea }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddIdea: (projectId: string, text: string) => void;
    onRemoveIdea: (projectId: string, ideaId: string) => void;
}) {
    const [newIdea, setNewIdea] = useState("");

    const handleAdd = () => {
        if (!newIdea.trim()) return;
        onAddIdea(project.id, newIdea.trim());
        setNewIdea("");
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
                {project.ideas.length > 0 && <span className="global-board-group-count">{project.ideas.length}</span>}
            </div>

            {project.ideas.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.ideas.map((idea) => (
                        <div key={idea.id} className="project-workspace-task">
                            <span className="project-workspace-idea-icon">
                                <Lightbulb size={13} strokeWidth={1.75} />
                            </span>
                            <span className="project-workspace-task-title project-workspace-idea-title">{idea.text}</span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveIdea(project.id, idea.id)}
                                aria-label="Remove idea"
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
                    value={newIdea}
                    onChange={(e) => setNewIdea(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Capture an idea for ${project.name}...`}
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newIdea.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Ideas — every project's idea capture in one place, grouped by
 * project. Same "aggregate existing per-project state" approach as
 * TasksBoard, reusing project.ideas rather than a second data model.
 */
export default function IdeasBoard({ projects, onSelectProject, onAddIdea, onRemoveIdea }: IdeasBoardProps) {
    const totalIdeas = projects.reduce((sum, p) => sum + p.ideas.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Ideas</h1>
                </div>
                {totalIdeas > 0 && <span className="global-board-summary">{totalIdeas} captured</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start capturing ideas.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectIdeaGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddIdea={onAddIdea}
                            onRemoveIdea={onRemoveIdea}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
