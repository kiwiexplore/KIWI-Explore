import { useState, type KeyboardEvent } from "react";
import { ImagePlus, Info, Plus, Trash2 } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface ImageGenerationBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddImagePrompt: (projectId: string, prompt: string) => void;
    onRemoveImagePrompt: (projectId: string, promptId: string) => void;
}

function ProjectImagePromptGroup({ project, onSelectProject, onAddImagePrompt, onRemoveImagePrompt }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddImagePrompt: (projectId: string, prompt: string) => void;
    onRemoveImagePrompt: (projectId: string, promptId: string) => void;
}) {
    const [newPrompt, setNewPrompt] = useState("");

    const handleAdd = () => {
        if (!newPrompt.trim()) return;
        onAddImagePrompt(project.id, newPrompt.trim());
        setNewPrompt("");
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
                {project.imagePrompts.length > 0 && <span className="global-board-group-count">{project.imagePrompts.length}</span>}
            </div>

            {project.imagePrompts.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.imagePrompts.map((item) => (
                        <div key={item.id} className="project-workspace-task">
                            <span className="project-workspace-idea-icon">
                                <ImagePlus size={13} strokeWidth={1.75} />
                            </span>
                            <span className="project-workspace-task-title project-workspace-idea-title">{item.prompt}</span>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveImagePrompt(project.id, item.id)}
                                aria-label="Remove prompt"
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
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Save an image prompt for ${project.name}...`}
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newPrompt.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Image Generation — a prompt log per project, grouped
 * together. Same honesty as useKiwiChat's own "no AI behind this yet":
 * saving a prompt here just tracks it in project.imagePrompts, nothing
 * actually generates an image. Real generation needs a model/API key
 * this app doesn't have configured.
 */
export default function ImageGenerationBoard({ projects, onSelectProject, onAddImagePrompt, onRemoveImagePrompt }: ImageGenerationBoardProps) {
    const totalPrompts = projects.reduce((sum, p) => sum + p.imagePrompts.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Image Generation</h1>
                </div>
                {totalPrompts > 0 && <span className="global-board-summary">{totalPrompts} saved</span>}
            </div>

            <div className="global-board-notice">
                <Info size={14} strokeWidth={2} />
                <span>Not connected to a live image model yet — prompts saved here are tracked for later, not generated.</span>
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start saving prompts.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectImagePromptGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddImagePrompt={onAddImagePrompt}
                            onRemoveImagePrompt={onRemoveImagePrompt}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
