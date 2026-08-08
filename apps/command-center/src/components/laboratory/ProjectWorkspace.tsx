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
}

export default function ProjectWorkspace({ project, onBack }: ProjectWorkspaceProps) {
    const [activeModule, setActiveModule] = useState("Overview");
    const status = STATUS_META[project.status];

    return (
        <div className="project-workspace">
            <button type="button" className="project-workspace-back" onClick={onBack}>
                <ArrowLeft size={14} strokeWidth={2} />
                Projects
            </button>

            <div className="project-workspace-header">
                <div>
                    <span className="project-workspace-category">{project.category}</span>
                    <h1>{project.name}</h1>
                    <p>{project.description}</p>
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
