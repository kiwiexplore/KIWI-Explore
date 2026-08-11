import { useState, type KeyboardEvent } from "react";
import { Link2, Plus, Rocket, Trash2 } from "lucide-react";
import { PROTOTYPE_STAGE_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface PrototypesBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddPrototype: (projectId: string, label: string, url: string) => void;
    onCyclePrototypeStage: (projectId: string, prototypeId: string) => void;
    onRemovePrototype: (projectId: string, prototypeId: string) => void;
}

function ProjectPrototypeGroup({ project, onSelectProject, onAddPrototype, onCyclePrototypeStage, onRemovePrototype }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddPrototype: (projectId: string, label: string, url: string) => void;
    onCyclePrototypeStage: (projectId: string, prototypeId: string) => void;
    onRemovePrototype: (projectId: string, prototypeId: string) => void;
}) {
    const [newLabel, setNewLabel] = useState("");
    const [newUrl, setNewUrl] = useState("");

    const handleAdd = () => {
        if (!newLabel.trim()) return;
        onAddPrototype(project.id, newLabel.trim(), newUrl.trim());
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
                {project.prototypes.length > 0 && <span className="global-board-group-count">{project.prototypes.length}</span>}
            </div>

            {project.prototypes.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.prototypes.map((proto) => {
                        const stageMeta = PROTOTYPE_STAGE_META[proto.stage];
                        return (
                            <div key={proto.id} className="project-workspace-task">
                                <span className="project-workspace-idea-icon">
                                    <Rocket size={13} strokeWidth={1.75} />
                                </span>
                                <span className="project-workspace-design-ref">
                                    <span className="project-workspace-task-title">{proto.label}</span>
                                    {proto.url && (
                                        <a href={proto.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                            <Link2 size={10} strokeWidth={2} />
                                            {proto.url}
                                        </a>
                                    )}
                                </span>
                                <button
                                    type="button"
                                    className="project-workspace-stage-pill"
                                    style={{ color: stageMeta.color, borderColor: stageMeta.color }}
                                    onClick={() => onCyclePrototypeStage(project.id, proto.id)}
                                    title="Click to advance stage"
                                >
                                    {stageMeta.label}
                                </button>
                                <button
                                    type="button"
                                    className="project-workspace-task-remove"
                                    onClick={() => onRemovePrototype(project.id, proto.id)}
                                    aria-label="Remove prototype"
                                >
                                    <Trash2 size={13} strokeWidth={1.75} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="project-workspace-task-add project-workspace-design-add">
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Prototype name..."
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
 * Global Prototypes — every project's prototype tracker in one place,
 * grouped by project. Reuses project.prototypes (same data the
 * per-project workspace's Prototype module already tracks), including
 * the click-to-advance stage pill.
 */
export default function PrototypesBoard({ projects, onSelectProject, onAddPrototype, onCyclePrototypeStage, onRemovePrototype }: PrototypesBoardProps) {
    const totalPrototypes = projects.reduce((sum, p) => sum + p.prototypes.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Prototypes</h1>
                </div>
                {totalPrototypes > 0 && <span className="global-board-summary">{totalPrototypes} tracked</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start tracking prototypes.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectPrototypeGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddPrototype={onAddPrototype}
                            onCyclePrototypeStage={onCyclePrototypeStage}
                            onRemovePrototype={onRemovePrototype}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
