import { Plus } from "lucide-react";
import ProjectCard from "./ProjectCard";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectGrid.css";

interface ProjectGridProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onCreateProject: () => void;
}

/**
 * Laboratory's landing screen — "tady začínám pracovat." A project grid
 * plus a New Project action, nothing else competing for attention (no
 * Weather/News/Finance-style widgets here, per explicit request — this
 * is a workspace, not another dashboard).
 */
export default function ProjectGrid({ projects, onSelectProject, onCreateProject }: ProjectGridProps) {
    return (
        <div className="project-grid-page">
            <div className="project-grid-header">
                <div>
                    <span className="project-grid-eyebrow">Laboratory</span>
                    <h1>Projects</h1>
                </div>
                <button type="button" className="project-grid-new" onClick={onCreateProject}>
                    <Plus size={16} strokeWidth={2} />
                    New Project
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="project-grid-empty">Nothing here yet — start your first project above.</div>
            ) : (
                <div className="project-grid">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}
