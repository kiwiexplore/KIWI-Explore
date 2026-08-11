import { useState, type KeyboardEvent } from "react";
import { ArrowLeft, File, FlaskConical, Lightbulb, Link2, Palette, Plus, Rocket, Sparkles, StickyNote, Trash2 } from "lucide-react";
import { PROTOTYPE_STAGE_META, STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import type { LabNote } from "../../state/laboratoryNotes";
import type { ResearchEntry } from "../../state/laboratoryResearch";
import "./ProjectWorkspace.css";

const MODULES = ["Overview", "Research", "Ideas", "Design", "Prototype", "Tasks", "Files", "Notes", "AI Lab"];

interface ProjectWorkspaceProps {
    project: LaboratoryProject;
    onBack: () => void;
    // Opens Laboratory's floating KIWI panel (already scoped to
    // whichever project is open) — the AI Lab tab hands off to that
    // single shared assistant instance rather than standing up a
    // second, unsynced chat.
    onOpenKiwi: () => void;
    onChange: (id: string, changes: Partial<Pick<LaboratoryProject, "name" | "category" | "description">>) => void;
    onAddTask: (projectId: string, title: string) => void;
    onToggleTask: (projectId: string, taskId: string) => void;
    onRemoveTask: (projectId: string, taskId: string) => void;
    onAddIdea: (projectId: string, text: string) => void;
    onRemoveIdea: (projectId: string, ideaId: string) => void;
    onAddDesignRef: (projectId: string, label: string, url: string) => void;
    onRemoveDesignRef: (projectId: string, refId: string) => void;
    onAddPrototype: (projectId: string, label: string, url: string) => void;
    onCyclePrototypeStage: (projectId: string, prototypeId: string) => void;
    onRemovePrototype: (projectId: string, prototypeId: string) => void;
    onAddFile: (projectId: string, name: string) => void;
    onRemoveFile: (projectId: string, fileId: string) => void;
    // Returns the new note's/finding's id so the workspace can jump
    // straight into editing it, same as the global Notes/Research
    // sections do.
    onAddNote: (projectId: string) => string;
    onNoteChange: (projectId: string, noteId: string, changes: Partial<Pick<LabNote, "title" | "content">>) => void;
    onAddResearch: (projectId: string) => string;
    onResearchChange: (projectId: string, entryId: string, changes: Partial<Pick<ResearchEntry, "title" | "summary" | "tag" | "source">>) => void;
}

/**
 * Name/category/description are editable in place (same "updates as
 * you type, no explicit save" mock philosophy as NoteEditor/
 * ResearchDetail) — a freshly created project starts as "Untitled
 * Project N" with no way to rename it otherwise, which is the very
 * first thing you'd want to fix on walking into it.
 */
export default function ProjectWorkspace({ project, onBack, onOpenKiwi, onChange, onAddTask, onToggleTask, onRemoveTask, onAddIdea, onRemoveIdea, onAddDesignRef, onRemoveDesignRef, onAddPrototype, onCyclePrototypeStage, onRemovePrototype, onAddFile, onRemoveFile, onAddNote, onNoteChange, onAddResearch, onResearchChange }: ProjectWorkspaceProps) {
    const [activeModule, setActiveModule] = useState("Overview");
    const [newTask, setNewTask] = useState("");
    const [newIdea, setNewIdea] = useState("");
    const [newDesignLabel, setNewDesignLabel] = useState("");
    const [newDesignUrl, setNewDesignUrl] = useState("");
    const [newProtoLabel, setNewProtoLabel] = useState("");
    const [newProtoUrl, setNewProtoUrl] = useState("");
    const [newFileName, setNewFileName] = useState("");
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [selectedResearchId, setSelectedResearchId] = useState<string | null>(null);
    const status = STATUS_META[project.status];
    const selectedNote = project.notes.find((n) => n.id === selectedNoteId) ?? null;
    const selectedResearch = project.research.find((r) => r.id === selectedResearchId) ?? null;

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

    const handleAddIdea = () => {
        if (!newIdea.trim()) return;
        onAddIdea(project.id, newIdea.trim());
        setNewIdea("");
    };

    const handleIdeaKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddIdea();
        }
    };

    const handleAddDesignRef = () => {
        if (!newDesignLabel.trim()) return;
        onAddDesignRef(project.id, newDesignLabel.trim(), newDesignUrl.trim());
        setNewDesignLabel("");
        setNewDesignUrl("");
    };

    const handleDesignKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddDesignRef();
        }
    };

    const handleAddPrototype = () => {
        if (!newProtoLabel.trim()) return;
        onAddPrototype(project.id, newProtoLabel.trim(), newProtoUrl.trim());
        setNewProtoLabel("");
        setNewProtoUrl("");
    };

    const handleProtoKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddPrototype();
        }
    };

    const handleAddFile = () => {
        if (!newFileName.trim()) return;
        onAddFile(project.id, newFileName.trim());
        setNewFileName("");
    };

    const handleFileKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddFile();
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
                        {m === "Research" && project.research.length > 0 && (
                            <span className="project-workspace-module-count">{project.research.length}</span>
                        )}
                        {m === "Ideas" && project.ideas.length > 0 && (
                            <span className="project-workspace-module-count">{project.ideas.length}</span>
                        )}
                        {m === "Design" && project.designRefs.length > 0 && (
                            <span className="project-workspace-module-count">{project.designRefs.length}</span>
                        )}
                        {m === "Prototype" && project.prototypes.length > 0 && (
                            <span className="project-workspace-module-count">{project.prototypes.length}</span>
                        )}
                        {m === "Files" && project.files.length > 0 && (
                            <span className="project-workspace-module-count">{project.files.length}</span>
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

                {activeModule === "Research" && (
                    selectedResearch ? (
                        <div className="project-workspace-note-editor">
                            <button type="button" className="project-workspace-note-back" onClick={() => setSelectedResearchId(null)}>
                                <ArrowLeft size={13} strokeWidth={2} />
                                Research
                            </button>
                            <input
                                type="text"
                                className="project-workspace-note-title"
                                value={selectedResearch.title}
                                onChange={(e) => onResearchChange(project.id, selectedResearch.id, { title: e.target.value })}
                                placeholder="Untitled finding"
                            />
                            <div className="project-workspace-research-meta-row">
                                <input
                                    type="text"
                                    className="project-workspace-research-meta-input"
                                    value={selectedResearch.tag}
                                    onChange={(e) => onResearchChange(project.id, selectedResearch.id, { tag: e.target.value })}
                                    placeholder="Tag"
                                />
                                <input
                                    type="text"
                                    className="project-workspace-research-meta-input"
                                    value={selectedResearch.source}
                                    onChange={(e) => onResearchChange(project.id, selectedResearch.id, { source: e.target.value })}
                                    placeholder="Source URL or citation (optional)"
                                />
                            </div>
                            <textarea
                                className="project-workspace-note-content"
                                value={selectedResearch.summary}
                                onChange={(e) => onResearchChange(project.id, selectedResearch.id, { summary: e.target.value })}
                                placeholder="What did you find?"
                                rows={6}
                            />
                        </div>
                    ) : (
                        <div className="project-workspace-notes">
                            <button type="button" className="project-workspace-notes-add" onClick={() => setSelectedResearchId(onAddResearch(project.id))}>
                                <Plus size={14} strokeWidth={2} />
                                Save Finding
                            </button>

                            {project.research.length === 0 ? (
                                <p className="project-workspace-tasks-empty">No findings yet — save the first one above.</p>
                            ) : (
                                <div className="project-workspace-notes-grid">
                                    {project.research.map((entry) => (
                                        <button key={entry.id} type="button" className="project-workspace-note-card" onClick={() => setSelectedResearchId(entry.id)}>
                                            <FlaskConical size={14} strokeWidth={1.75} className="project-workspace-note-card-icon" />
                                            <span className="project-workspace-note-card-title">{entry.title}</span>
                                            <span className="project-workspace-note-card-preview">{entry.summary || "No summary yet."}</span>
                                            {entry.source && (
                                                <span className="project-workspace-note-card-source">
                                                    <Link2 size={10} strokeWidth={2} />
                                                    {entry.source}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
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

                {activeModule === "Ideas" && (
                    <div className="project-workspace-tasks">
                        {project.ideas.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No ideas yet — capture the first one below.</p>
                        ) : (
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
                                onKeyDown={handleIdeaKeyDown}
                                placeholder="Capture an idea..."
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddIdea} disabled={!newIdea.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Design" && (
                    <div className="project-workspace-tasks">
                        {project.designRefs.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No references yet — drop a link below.</p>
                        ) : (
                            <div className="project-workspace-task-list">
                                {project.designRefs.map((ref) => (
                                    <div key={ref.id} className="project-workspace-task">
                                        <span className="project-workspace-idea-icon">
                                            <Palette size={13} strokeWidth={1.75} />
                                        </span>
                                        <span className="project-workspace-design-ref">
                                            <span className="project-workspace-task-title">{ref.label}</span>
                                            {ref.url && (
                                                <a href={ref.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                                    <Link2 size={10} strokeWidth={2} />
                                                    {ref.url}
                                                </a>
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            className="project-workspace-task-remove"
                                            onClick={() => onRemoveDesignRef(project.id, ref.id)}
                                            aria-label="Remove reference"
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
                                value={newDesignLabel}
                                onChange={(e) => setNewDesignLabel(e.target.value)}
                                onKeyDown={handleDesignKeyDown}
                                placeholder="Reference name..."
                            />
                            <input
                                type="text"
                                className="project-workspace-task-input"
                                value={newDesignUrl}
                                onChange={(e) => setNewDesignUrl(e.target.value)}
                                onKeyDown={handleDesignKeyDown}
                                placeholder="Link (optional)"
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddDesignRef} disabled={!newDesignLabel.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Prototype" && (
                    <div className="project-workspace-tasks">
                        {project.prototypes.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No prototypes yet — add the first one below.</p>
                        ) : (
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
                                value={newProtoLabel}
                                onChange={(e) => setNewProtoLabel(e.target.value)}
                                onKeyDown={handleProtoKeyDown}
                                placeholder="Prototype name..."
                            />
                            <input
                                type="text"
                                className="project-workspace-task-input"
                                value={newProtoUrl}
                                onChange={(e) => setNewProtoUrl(e.target.value)}
                                onKeyDown={handleProtoKeyDown}
                                placeholder="Link (optional)"
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddPrototype} disabled={!newProtoLabel.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Files" && (
                    <div className="project-workspace-tasks">
                        {project.files.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No files tracked yet — add one below.</p>
                        ) : (
                            <div className="project-workspace-task-list">
                                {project.files.map((file) => (
                                    <div key={file.id} className="project-workspace-task">
                                        <span className="project-workspace-idea-icon">
                                            <File size={13} strokeWidth={1.75} />
                                        </span>
                                        <span className="project-workspace-task-title">{file.name}</span>
                                        <button
                                            type="button"
                                            className="project-workspace-task-remove"
                                            onClick={() => onRemoveFile(project.id, file.id)}
                                            aria-label="Remove file"
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
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                onKeyDown={handleFileKeyDown}
                                placeholder="Track a file by name..."
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddFile} disabled={!newFileName.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "AI Lab" && (
                    <div className="project-workspace-ai-lab">
                        <Sparkles size={22} strokeWidth={1.5} className="project-workspace-ai-lab-icon" />
                        <p className="project-workspace-ai-lab-text">
                            Ask KIWI about {project.name} — it already knows this project's status, tags, and progress.
                        </p>
                        <button type="button" className="project-workspace-notes-add" onClick={onOpenKiwi}>
                            <Sparkles size={14} strokeWidth={2} />
                            Open KIWI Assistant
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
