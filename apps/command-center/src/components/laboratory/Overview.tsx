import { ArrowRight, Circle, FlaskConical, Plus, StickyNote } from "lucide-react";
import { STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import type { LabNote } from "../../state/laboratoryNotes";
import type { ResearchEntry } from "../../state/laboratoryResearch";
import type { LaboratorySection } from "./Laboratory";
import "./Overview.css";

interface OpenTask {
    projectId: string;
    projectName: string;
    taskId: string;
    title: string;
}

interface OverviewProps {
    projects: LaboratoryProject[];
    notes: LabNote[];
    researchEntries: ResearchEntry[];
    onSelectProject: (id: string) => void;
    onCreateProject: () => void;
    onGoToSection: (section: LaboratorySection) => void;
    onSelectNote: (id: string) => void;
    onSelectResearch: (id: string) => void;
    onToggleTask: (projectId: string, taskId: string) => void;
}

/**
 * Laboratory's landing screen — a snapshot across everything Laboratory
 * already tracks (projects, tasks, notes, research), not a new data
 * source of its own. Same "no fake widgets" discipline as ProjectGrid:
 * every number and list here reads directly off state Laboratory.tsx
 * already owns.
 */
export default function Overview({
    projects, notes, researchEntries, onSelectProject, onCreateProject, onGoToSection, onSelectNote, onSelectResearch, onToggleTask,
}: OverviewProps) {
    const openTasks: OpenTask[] = projects.flatMap((project) => (
        project.tasks
            .filter((task) => !task.done)
            .map((task) => ({ projectId: project.id, projectName: project.name, taskId: task.id, title: task.title }))
    )).slice(0, 6);

    const recentProjects = projects.slice(0, 4);
    const recentNotes = notes.slice(0, 3);
    const recentResearch = researchEntries.slice(0, 3);
    const featuredProject = projects[0] ?? null;

    return (
        <div className="lab-overview-page">
            <div className="lab-overview-header">
                <div>
                    <span className="lab-overview-eyebrow">Laboratory</span>
                    <h1>Overview</h1>
                </div>
                <button type="button" className="lab-overview-new" onClick={onCreateProject}>
                    <Plus size={16} strokeWidth={2} />
                    New Project
                </button>
            </div>

            {featuredProject && (
                <button type="button" className="lab-overview-continue" onClick={() => onSelectProject(featuredProject.id)}>
                    <div className="lab-overview-continue-text">
                        <span className="lab-overview-continue-label">Continue where you left off</span>
                        <span className="lab-overview-continue-name">{featuredProject.name}</span>
                        <span className="lab-overview-continue-meta">
                            {STATUS_META[featuredProject.status].label} · {featuredProject.progress}% · {featuredProject.lastActivity}
                        </span>
                    </div>
                    <ArrowRight size={18} strokeWidth={2} />
                </button>
            )}

            <div className="lab-overview-grid">
                <section className="lab-overview-panel">
                    <div className="lab-overview-panel-header">
                        <h2>Projects</h2>
                        <button type="button" className="lab-overview-view-all" onClick={() => onGoToSection("projects")}>
                            View all <ArrowRight size={13} strokeWidth={2} />
                        </button>
                    </div>
                    {recentProjects.length === 0 ? (
                        <p className="lab-overview-empty">No projects yet — start your first one above.</p>
                    ) : (
                        <ul className="lab-overview-list">
                            {recentProjects.map((project) => (
                                <li key={project.id}>
                                    <button type="button" className="lab-overview-row" onClick={() => onSelectProject(project.id)}>
                                        <span
                                            className="lab-overview-status-dot"
                                            style={{ background: STATUS_META[project.status].color }}
                                        />
                                        <span className="lab-overview-row-name">{project.name}</span>
                                        <span className="lab-overview-row-meta">{project.progress}%</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="lab-overview-panel">
                    <div className="lab-overview-panel-header">
                        <h2>Open Tasks</h2>
                    </div>
                    {openTasks.length === 0 ? (
                        <p className="lab-overview-empty">Nothing open — every tracked task is done.</p>
                    ) : (
                        <ul className="lab-overview-list">
                            {openTasks.map((task) => (
                                <li key={task.taskId}>
                                    <button
                                        type="button"
                                        className="lab-overview-row lab-overview-task"
                                        onClick={() => onToggleTask(task.projectId, task.taskId)}
                                    >
                                        <Circle size={14} strokeWidth={2} className="lab-overview-task-icon" />
                                        <span className="lab-overview-row-name">{task.title}</span>
                                        <span className="lab-overview-row-meta">{task.projectName}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="lab-overview-panel">
                    <div className="lab-overview-panel-header">
                        <h2>Recent Notes</h2>
                        <button type="button" className="lab-overview-view-all" onClick={() => onGoToSection("notes")}>
                            View all <ArrowRight size={13} strokeWidth={2} />
                        </button>
                    </div>
                    {recentNotes.length === 0 ? (
                        <p className="lab-overview-empty">No notes yet.</p>
                    ) : (
                        <ul className="lab-overview-list">
                            {recentNotes.map((note) => (
                                <li key={note.id}>
                                    <button type="button" className="lab-overview-row" onClick={() => onSelectNote(note.id)}>
                                        <StickyNote size={14} strokeWidth={1.75} className="lab-overview-task-icon" />
                                        <span className="lab-overview-row-name">{note.title}</span>
                                        <span className="lab-overview-row-meta">{note.updatedAt}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="lab-overview-panel">
                    <div className="lab-overview-panel-header">
                        <h2>Recent Research</h2>
                        <button type="button" className="lab-overview-view-all" onClick={() => onGoToSection("research")}>
                            View all <ArrowRight size={13} strokeWidth={2} />
                        </button>
                    </div>
                    {recentResearch.length === 0 ? (
                        <p className="lab-overview-empty">No findings saved yet.</p>
                    ) : (
                        <ul className="lab-overview-list">
                            {recentResearch.map((entry) => (
                                <li key={entry.id}>
                                    <button type="button" className="lab-overview-row" onClick={() => onSelectResearch(entry.id)}>
                                        <FlaskConical size={14} strokeWidth={1.75} className="lab-overview-task-icon" />
                                        <span className="lab-overview-row-name">{entry.title}</span>
                                        <span className="lab-overview-row-meta">{entry.savedAt}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
