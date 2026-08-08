import { STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectCard.css";

interface ProjectCardProps {
    project: LaboratoryProject;
    onClick: () => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
    const status = STATUS_META[project.status];

    return (
        <button type="button" className="project-card" onClick={onClick}>
            <div className="project-card-top">
                <span className="project-card-category">{project.category}</span>
                <span className="project-card-status" style={{ color: status.color, borderColor: status.color }}>
                    {status.label}
                </span>
            </div>

            <h3 className="project-card-name">{project.name}</h3>
            <p className="project-card-description">{project.description}</p>

            <div className="project-card-progress">
                <div className="project-card-progress-track">
                    <div className="project-card-progress-fill" style={{ width: `${project.progress}%` }} />
                </div>
                <span className="project-card-progress-label">{project.progress}%</span>
            </div>

            <div className="project-card-footer">
                <div className="project-card-tags">
                    {project.tags.map((tag) => <span key={tag} className="project-card-tag">{tag}</span>)}
                </div>
                <span className="project-card-activity">{project.lastActivity}</span>
            </div>
        </button>
    );
}
