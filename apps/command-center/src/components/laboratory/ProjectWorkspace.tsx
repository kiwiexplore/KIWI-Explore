import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";

// Not all of these are real yet — Overview is the only module with
// actual content (see the render below). The rest just need to exist
// as tabs now so the architecture doesn't have to change shape later
// to fit them in, per explicit request.
const MODULES = ["Overview", "Research", "Ideas", "Design", "Prototype", "Tasks", "Files", "Notes", "AI Lab"];

interface ProjectWorkspaceProps {
    project: LaboratoryProject;
    onBack: () => void;
    onChange: (id: string, changes: Partial<Pick<LaboratoryProject, "name" | "category" | "description">>) => void;
}

/**
 * Name/category/description are editable in place (same "updates as
 * you type, no explicit save" mock philosophy as NoteEditor/
 * ResearchDetail) — a freshly created project starts as "Untitled
 * Project N" with no way to rename it otherwise, which is the very
 * first thing you'd want to fix on walking into it.
 */
export default function ProjectWorkspace({ project, onBack, onChange }: ProjectWorkspaceProps) {
    const [activeModule, setActiveModule] = useState("Overview");
    const status = STATUS_META[project.status];

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
                    </button>
                ))}
            </nav>

            <div className="project-workspace-body">
                {activeModule === "Overview" ? (
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
                ) : (
                    <div className="project-workspace-soon">
                        <span className="project-workspace-soon-title">{activeModule}</span>
                        <p>This module isn't built yet — it's next in line.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
