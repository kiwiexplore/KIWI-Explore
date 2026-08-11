import { useState, type KeyboardEvent } from "react";
import { ArrowLeft, Plus, StickyNote, Trash2 } from "lucide-react";
import { STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import type { LabNote } from "../../state/laboratoryNotes";
import "./ProjectWorkspace.css";

// Not all of these are real yet — Overview, Tasks, and Notes are the
// only modules with actual content (see the render below). The rest
// just need to exist as tabs now so the architecture doesn't have to
// change shape later to fit them in, per explicit request.
const MODULES = ["Overview", "Research", "Ideas", "Design", "Prototype", "Tasks", "Files", "Notes", "AI Lab"];

interface ProjectWorkspaceProps {
    project: LaboratoryProject;
    onBack: () => void;
    onChange: (id: string, changes: Partial<Pick<LaboratoryProject, "name" | "category" | "description">>) => void;
    onAddTask: (projectId: string, title: string) => void;
    onToggleTask: (projectId: string, taskId: string) => void;
    onRemoveTask: (projectId: string, taskId: string) => void;
    // Returns the new note's id so the workspace can jump straight
    // into editing it, same as the global Notes section does.
    onAddNote: (projectId: string) => string;
    onNoteChange: (projectId: string, noteId: string, changes: Partial<Pick<LabNote, "title" | "content">>) => void;
}

/**
 * Name/category/description are editable in place (same "updates as
 * you type, no explicit save" mock philosophy as NoteEditor/
 * ResearchDetail) — a freshly created project starts as "Untitled
 * Project N" with no way to rename it otherwise, which is the very
 * first thing you'd want to fix on walking into it.
 */
export default function ProjectWorkspace({ project, onBack, onChange, onAddTask, onToggleTask, onRemoveTask, onAddNote, onNoteChange }: ProjectWorkspaceProps) {
    const [activeModule, setActiveModule] = useState("Overview");
    const [newTask, setNewTask] = useState("");
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const status = STATUS_META[project.status];
    const selectedNote = project.notes.find((n) => n.id === selectedNoteId) ?? null;

    const handleAddTask = () => {
        if (!newTask.trim()) return;
        onAddTask(project.id, newTask.trim());
        setNewTask("");
    };

    const handleTaskKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddTask();
        }
    };

    const doneCount = project.tasks.filter((t) => t.done).length;

    return (
        <div className="project-workspace">
            <button type="button" className="project-workspace-back" onClick={onBack}>
                <ArrowLeft size={14} strokeWidth={2} />
                Projects
            </button>

            <div className="project-workspace-header">
                <div className="project-workspace-header-fields">
                    <input
                        type="text"
                        className="project-workspace-category-input"
                        value={project.category}
                        onChange={(e) => onChange(project.id, { category: e.target.value })}
                        placeholder="Category"
                    />
                    <input
                        type="text"
                        className="project-workspace-title"
                        value={project.name}
                        onChange={(e) => onChange(project.id, { name: e.target.value })}
                        placeholder="Untitled project"
                    />
                    <textarea
                        className="project-workspace-description"
                        value={project.description}
                        onChange={(e) => onChange(project.id, { description: e.target.value })}
                        placeholder="What is this project about?"
                        rows={2}
                    />
                </div>
                <span className="project-workspace-status" style={{ color: status.color, borderColor: status.color }}>
                    {status.label}
                </span>
            </div>

            <nav className="project-workspace-modules">
                {MODULES.map((m) => (
                    <button
                        key={m}
                        type="button"
                        className={`project-workspace-module${activeModule === m ? " project-workspace-module-active" : ""}`}
                        onClick={() => setActiveModule(m)}
                    >
                        {m}
                        {m === "Tasks" && project.tasks.length > 0 && (
                            <span className="project-workspace-module-count">{doneCount}/{project.tasks.length}</span>
                        )}
                        {m === "Notes" && project.notes.length > 0 && (
                            <span className="project-workspace-module-count">{project.notes.length}</span>
                        )}
                    </button>
                ))}
            </nav>

            <div className="project-workspace-body">
                {activeModule === "Overview" && (
                    <div className="project-workspace-overview">
                        <div className="project-workspace-stat">
                            <span className="project-workspace-stat-label">Progress</span>
                            <div className="project-workspace-progress-track">
                                <div className="project-workspace-progress-fill" style={{ width: `${project.progress}%` }} />
                            </div>
                            <span className="project-workspace-stat-value">{project.progress}%</span>
                        </div>

                        {project.tags.length > 0 && (
                            <div className="project-workspace-tags">
                                {project.tags.map((tag) => <span key={tag} className="project-workspace-tag">{tag}</span>)}
                            </div>
                        )}

                        <div className="project-workspace-meta">Last activity: {project.lastActivity}</div>
                    </div>
                )}

                {activeModule === "Tasks" && (
                    <div className="project-workspace-tasks">
                        {project.tasks.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No tasks yet — add the first one below.</p>
                        ) : (
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
                                onKeyDown={handleTaskKeyDown}
                                placeholder="Add a task..."
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddTask} disabled={!newTask.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Notes" && (
                    selectedNote ? (
                        <div className="project-workspace-note-editor">
                            <button type="button" className="project-workspace-note-back" onClick={() => setSelectedNoteId(null)}>
                                <ArrowLeft size={13} strokeWidth={2} />
                                Notes
                            </button>
                            <input
                                type="text"
                                className="project-workspace-note-title"
                                value={selectedNote.title}
                                onChange={(e) => onNoteChange(project.id, selectedNote.id, { title: e.target.value })}
                                placeholder="Untitled note"
                            />
                            <textarea
                                className="project-workspace-note-content"
                                value={selectedNote.content}
                                onChange={(e) => onNoteChange(project.id, selectedNote.id, { content: e.target.value })}
                                placeholder="Start writing..."
                                rows={7}
                            />
                        </div>
                    ) : (
                        <div className="project-workspace-notes">
                            <button type="button" className="project-workspace-notes-add" onClick={() => setSelectedNoteId(onAddNote(project.id))}>
                                <Plus size={14} strokeWidth={2} />
                                New Note
                            </button>

                            {project.notes.length === 0 ? (
                                <p className="project-workspace-tasks-empty">No notes yet — add the first one above.</p>
                            ) : (
                                <div className="project-workspace-notes-grid">
                                    {project.notes.map((note) => (
                                        <button key={note.id} type="button" className="project-workspace-note-card" onClick={() => setSelectedNoteId(note.id)}>
                                            <StickyNote size={14} strokeWidth={1.75} className="project-workspace-note-card-icon" />
                                            <span className="project-workspace-note-card-title">{note.title}</span>
                                            <span className="project-workspace-note-card-preview">{note.content || "Empty note."}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                )}

                {activeModule !== "Overview" && activeModule !== "Tasks" && activeModule !== "Notes" && (
                    <div className="project-workspace-soon">
                        <span className="project-workspace-soon-title">{activeModule}</span>
                        <p>This module isn't built yet — it's next in line.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
