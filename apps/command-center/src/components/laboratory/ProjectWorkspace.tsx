import { useState, type KeyboardEvent } from "react";
import {
    ArrowLeft, File, FileText, FlaskConical, Library, Lightbulb, Link2, Megaphone, Package, Palette,
    Plus, Rocket, Sparkles, StickyNote, Store as StoreIcon, TestTube2, Trash2,
} from "lucide-react";
import {
    PRODUCT_STAGE_META, PROTOTYPE_STAGE_META, STATUS_META, TEST_STATUS_META, MARKETING_STATUS_META,
    type LaboratoryProject,
} from "../../state/laboratoryProjects";
import type { LabNote } from "../../state/laboratoryNotes";
import type { ResearchEntry } from "../../state/laboratoryResearch";
import "./ProjectWorkspace.css";

const MODULES = [
    "Overview", "Research", "Ideas", "Design", "Prototype", "Tasks",
    "Resources", "Tests", "Documents", "Files",
    "Products", "Store", "Marketing",
    "Notes", "AI Lab",
];

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
    onAddResource: (projectId: string, label: string, url: string) => void;
    onRemoveResource: (projectId: string, resourceId: string) => void;
    onAddTest: (projectId: string, title: string) => void;
    onCycleTestStatus: (projectId: string, testId: string) => void;
    onRemoveTest: (projectId: string, testId: string) => void;
    onAddDocument: (projectId: string, label: string, url: string) => void;
    onRemoveDocument: (projectId: string, documentId: string) => void;
    onAddProduct: (projectId: string, name: string, price: string) => void;
    onCycleProductStage: (projectId: string, productId: string) => void;
    onRemoveProduct: (projectId: string, productId: string) => void;
    onAddStoreChannel: (projectId: string, label: string, url: string) => void;
    onRemoveStoreChannel: (projectId: string, channelId: string) => void;
    onAddMarketingItem: (projectId: string, label: string) => void;
    onCycleMarketingStatus: (projectId: string, itemId: string) => void;
    onRemoveMarketingItem: (projectId: string, itemId: string) => void;
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
export default function ProjectWorkspace({
    project, onBack, onOpenKiwi, onChange,
    onAddTask, onToggleTask, onRemoveTask,
    onAddIdea, onRemoveIdea,
    onAddDesignRef, onRemoveDesignRef,
    onAddPrototype, onCyclePrototypeStage, onRemovePrototype,
    onAddFile, onRemoveFile,
    onAddResource, onRemoveResource,
    onAddTest, onCycleTestStatus, onRemoveTest,
    onAddDocument, onRemoveDocument,
    onAddProduct, onCycleProductStage, onRemoveProduct,
    onAddStoreChannel, onRemoveStoreChannel,
    onAddMarketingItem, onCycleMarketingStatus, onRemoveMarketingItem,
    onAddNote, onNoteChange, onAddResearch, onResearchChange,
}: ProjectWorkspaceProps) {
    const [activeModule, setActiveModule] = useState("Overview");
    const [newTask, setNewTask] = useState("");
    const [newIdea, setNewIdea] = useState("");
    const [newDesignLabel, setNewDesignLabel] = useState("");
    const [newDesignUrl, setNewDesignUrl] = useState("");
    const [newProtoLabel, setNewProtoLabel] = useState("");
    const [newProtoUrl, setNewProtoUrl] = useState("");
    const [newFileName, setNewFileName] = useState("");
    const [newResourceLabel, setNewResourceLabel] = useState("");
    const [newResourceUrl, setNewResourceUrl] = useState("");
    const [newTestTitle, setNewTestTitle] = useState("");
    const [newDocumentLabel, setNewDocumentLabel] = useState("");
    const [newDocumentUrl, setNewDocumentUrl] = useState("");
    const [newProductName, setNewProductName] = useState("");
    const [newProductPrice, setNewProductPrice] = useState("");
    const [newStoreLabel, setNewStoreLabel] = useState("");
    const [newStoreUrl, setNewStoreUrl] = useState("");
    const [newMarketingLabel, setNewMarketingLabel] = useState("");
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

    const handleAddResource = () => {
        if (!newResourceLabel.trim()) return;
        onAddResource(project.id, newResourceLabel.trim(), newResourceUrl.trim());
        setNewResourceLabel("");
        setNewResourceUrl("");
    };

    const handleResourceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddResource();
        }
    };

    const handleAddTest = () => {
        if (!newTestTitle.trim()) return;
        onAddTest(project.id, newTestTitle.trim());
        setNewTestTitle("");
    };

    const handleTestKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddTest();
        }
    };

    const handleAddDocument = () => {
        if (!newDocumentLabel.trim()) return;
        onAddDocument(project.id, newDocumentLabel.trim(), newDocumentUrl.trim());
        setNewDocumentLabel("");
        setNewDocumentUrl("");
    };

    const handleDocumentKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddDocument();
        }
    };

    const handleAddProduct = () => {
        if (!newProductName.trim()) return;
        onAddProduct(project.id, newProductName.trim(), newProductPrice.trim());
        setNewProductName("");
        setNewProductPrice("");
    };

    const handleProductKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddProduct();
        }
    };

    const handleAddStoreChannel = () => {
        if (!newStoreLabel.trim()) return;
        onAddStoreChannel(project.id, newStoreLabel.trim(), newStoreUrl.trim());
        setNewStoreLabel("");
        setNewStoreUrl("");
    };

    const handleStoreKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddStoreChannel();
        }
    };

    const handleAddMarketingItem = () => {
        if (!newMarketingLabel.trim()) return;
        onAddMarketingItem(project.id, newMarketingLabel.trim());
        setNewMarketingLabel("");
    };

    const handleMarketingKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddMarketingItem();
        }
    };

    const doneCount = project.tasks.filter((t) => t.done).length;
    const passingTestCount = project.tests.filter((t) => t.status === "passing").length;

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
                        {m === "Resources" && project.resources.length > 0 && (
                            <span className="project-workspace-module-count">{project.resources.length}</span>
                        )}
                        {m === "Tests" && project.tests.length > 0 && (
                            <span className="project-workspace-module-count">{passingTestCount}/{project.tests.length}</span>
                        )}
                        {m === "Documents" && project.documents.length > 0 && (
                            <span className="project-workspace-module-count">{project.documents.length}</span>
                        )}
                        {m === "Products" && project.products.length > 0 && (
                            <span className="project-workspace-module-count">{project.products.length}</span>
                        )}
                        {m === "Store" && project.storeChannels.length > 0 && (
                            <span className="project-workspace-module-count">{project.storeChannels.length}</span>
                        )}
                        {m === "Marketing" && project.marketing.length > 0 && (
                            <span className="project-workspace-module-count">{project.marketing.length}</span>
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

                {activeModule === "Resources" && (
                    <div className="project-workspace-tasks">
                        {project.resources.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No resources yet — drop a link below.</p>
                        ) : (
                            <div className="project-workspace-task-list">
                                {project.resources.map((resource) => (
                                    <div key={resource.id} className="project-workspace-task">
                                        <span className="project-workspace-idea-icon">
                                            <Library size={13} strokeWidth={1.75} />
                                        </span>
                                        <span className="project-workspace-design-ref">
                                            <span className="project-workspace-task-title">{resource.label}</span>
                                            {resource.url && (
                                                <a href={resource.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                                    <Link2 size={10} strokeWidth={2} />
                                                    {resource.url}
                                                </a>
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            className="project-workspace-task-remove"
                                            onClick={() => onRemoveResource(project.id, resource.id)}
                                            aria-label="Remove resource"
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
                                value={newResourceLabel}
                                onChange={(e) => setNewResourceLabel(e.target.value)}
                                onKeyDown={handleResourceKeyDown}
                                placeholder="Resource name..."
                            />
                            <input
                                type="text"
                                className="project-workspace-task-input"
                                value={newResourceUrl}
                                onChange={(e) => setNewResourceUrl(e.target.value)}
                                onKeyDown={handleResourceKeyDown}
                                placeholder="Link (optional)"
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddResource} disabled={!newResourceLabel.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Tests" && (
                    <div className="project-workspace-tasks">
                        {project.tests.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No tests yet — add the first one below.</p>
                        ) : (
                            <div className="project-workspace-task-list">
                                {project.tests.map((test) => {
                                    const statusMeta = TEST_STATUS_META[test.status];
                                    return (
                                        <div key={test.id} className="project-workspace-task">
                                            <span className="project-workspace-idea-icon">
                                                <TestTube2 size={13} strokeWidth={1.75} />
                                            </span>
                                            <span className="project-workspace-task-title project-workspace-idea-title">{test.title}</span>
                                            <button
                                                type="button"
                                                className="project-workspace-stage-pill"
                                                style={{ color: statusMeta.color, borderColor: statusMeta.color }}
                                                onClick={() => onCycleTestStatus(project.id, test.id)}
                                                title="Click to advance status"
                                            >
                                                {statusMeta.label}
                                            </button>
                                            <button
                                                type="button"
                                                className="project-workspace-task-remove"
                                                onClick={() => onRemoveTest(project.id, test.id)}
                                                aria-label="Remove test"
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
                                value={newTestTitle}
                                onChange={(e) => setNewTestTitle(e.target.value)}
                                onKeyDown={handleTestKeyDown}
                                placeholder="Add a test case..."
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddTest} disabled={!newTestTitle.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Documents" && (
                    <div className="project-workspace-tasks">
                        {project.documents.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No documents linked yet — drop one below.</p>
                        ) : (
                            <div className="project-workspace-task-list">
                                {project.documents.map((doc) => (
                                    <div key={doc.id} className="project-workspace-task">
                                        <span className="project-workspace-idea-icon">
                                            <FileText size={13} strokeWidth={1.75} />
                                        </span>
                                        <span className="project-workspace-design-ref">
                                            <span className="project-workspace-task-title">{doc.label}</span>
                                            {doc.url && (
                                                <a href={doc.url} target="_blank" rel="noreferrer" className="project-workspace-note-card-source">
                                                    <Link2 size={10} strokeWidth={2} />
                                                    {doc.url}
                                                </a>
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            className="project-workspace-task-remove"
                                            onClick={() => onRemoveDocument(project.id, doc.id)}
                                            aria-label="Remove document"
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
                                value={newDocumentLabel}
                                onChange={(e) => setNewDocumentLabel(e.target.value)}
                                onKeyDown={handleDocumentKeyDown}
                                placeholder="Document name..."
                            />
                            <input
                                type="text"
                                className="project-workspace-task-input"
                                value={newDocumentUrl}
                                onChange={(e) => setNewDocumentUrl(e.target.value)}
                                onKeyDown={handleDocumentKeyDown}
                                placeholder="Link (optional)"
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddDocument} disabled={!newDocumentLabel.trim()}>
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

                {activeModule === "Products" && (
                    <div className="project-workspace-tasks">
                        {project.products.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No products yet — add the first one below.</p>
                        ) : (
                            <div className="project-workspace-task-list">
                                {project.products.map((product) => {
                                    const stageMeta = PRODUCT_STAGE_META[product.stage];
                                    return (
                                        <div key={product.id} className="project-workspace-task">
                                            <span className="project-workspace-idea-icon">
                                                <Package size={13} strokeWidth={1.75} />
                                            </span>
                                            <span className="project-workspace-design-ref">
                                                <span className="project-workspace-task-title">{product.name}</span>
                                                {product.price && (
                                                    <span className="project-workspace-note-card-source">{product.price}</span>
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                className="project-workspace-stage-pill"
                                                style={{ color: stageMeta.color, borderColor: stageMeta.color }}
                                                onClick={() => onCycleProductStage(project.id, product.id)}
                                                title="Click to advance stage"
                                            >
                                                {stageMeta.label}
                                            </button>
                                            <button
                                                type="button"
                                                className="project-workspace-task-remove"
                                                onClick={() => onRemoveProduct(project.id, product.id)}
                                                aria-label="Remove product"
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
                                value={newProductName}
                                onChange={(e) => setNewProductName(e.target.value)}
                                onKeyDown={handleProductKeyDown}
                                placeholder="Product name..."
                            />
                            <input
                                type="text"
                                className="project-workspace-task-input"
                                value={newProductPrice}
                                onChange={(e) => setNewProductPrice(e.target.value)}
                                onKeyDown={handleProductKeyDown}
                                placeholder="Price (optional)"
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddProduct} disabled={!newProductName.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Store" && (
                    <div className="project-workspace-tasks">
                        {project.storeChannels.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No sales channels yet — add one below.</p>
                        ) : (
                            <div className="project-workspace-task-list">
                                {project.storeChannels.map((channel) => (
                                    <div key={channel.id} className="project-workspace-task">
                                        <span className="project-workspace-idea-icon">
                                            <StoreIcon size={13} strokeWidth={1.75} />
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
                                value={newStoreLabel}
                                onChange={(e) => setNewStoreLabel(e.target.value)}
                                onKeyDown={handleStoreKeyDown}
                                placeholder="Channel name (Etsy, App Store...)"
                            />
                            <input
                                type="text"
                                className="project-workspace-task-input"
                                value={newStoreUrl}
                                onChange={(e) => setNewStoreUrl(e.target.value)}
                                onKeyDown={handleStoreKeyDown}
                                placeholder="Link (optional)"
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddStoreChannel} disabled={!newStoreLabel.trim()}>
                                <Plus size={15} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                )}

                {activeModule === "Marketing" && (
                    <div className="project-workspace-tasks">
                        {project.marketing.length === 0 ? (
                            <p className="project-workspace-tasks-empty">No marketing items yet — add the first one below.</p>
                        ) : (
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
                                value={newMarketingLabel}
                                onChange={(e) => setNewMarketingLabel(e.target.value)}
                                onKeyDown={handleMarketingKeyDown}
                                placeholder="Add a marketing item..."
                            />
                            <button type="button" className="project-workspace-task-add-btn" onClick={handleAddMarketingItem} disabled={!newMarketingLabel.trim()}>
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
