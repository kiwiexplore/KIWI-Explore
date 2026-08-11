import { useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface TasksBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddTask: (projectId: string, title: string) => void;
    onToggleTask: (projectId: string, taskId: string) => void;
    onRemoveTask: (projectId: string, taskId: string) => void;
}

function ProjectTaskGroup({ project, onSelectProject, onAddTask, onToggleTask, onRemoveTask }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddTask: (projectId: string, title: string) => void;
    onToggleTask: (projectId: string, taskId: string) => void;
    onRemoveTask: (projectId: string, taskId: string) => void;
}) {
    const [newTask, setNewTask] = useState("");
    const doneCount = project.tasks.filter((t) => t.done).length;

    const handleAdd = () => {
        if (!newTask.trim()) return;
        onAddTask(project.id, newTask.trim());
        setNewTask("");
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
                {project.tasks.length > 0 && (
                    <span className="global-board-group-count">{doneCount}/{project.tasks.length}</span>
                )}
            </div>

            {project.tasks.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.tasks.map((task) => (
                        <div key={task.id} className="project-workspace-task">
                            <label className="project-workspace-task-checkbox">
                                <input
                                    type="checkbox"
                                    checked={task.done}
                                    onChange={() => onToggleTask(project.id, task.id)}
                                />
                                <span className={`project-workspace-task-title${task.done ? " project-workspace-task-title-done" : ""}`}>
                                    {task.title}
                                </span>
                            </label>
                            <button
                                type="button"
                                className="project-workspace-task-remove"
                                onClick={() => onRemoveTask(project.id, task.id)}
                                aria-label="Remove task"
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
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Add a task to ${project.name}...`}
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newTask.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Tasks — every project's task list in one place, grouped by
 * project (same shape Overview's "Open Tasks" panel summarizes, but
 * the full board: done tasks included, add/remove per project). Reuses
 * ProjectWorkspace's own task handlers and CSS classes rather than
 * introducing a second task data model.
 */
export default function TasksBoard({ projects, onSelectProject, onAddTask, onToggleTask, onRemoveTask }: TasksBoardProps) {
    const totalOpen = projects.reduce((sum, p) => sum + p.tasks.filter((t) => !t.done).length, 0);
    const totalTasks = projects.reduce((sum, p) => sum + p.tasks.length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Tasks</h1>
                </div>
                {totalTasks > 0 && <span className="global-board-summary">{totalOpen} open · {totalTasks} total</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start tracking tasks.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectTaskGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddTask={onAddTask}
                            onToggleTask={onToggleTask}
                            onRemoveTask={onRemoveTask}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
