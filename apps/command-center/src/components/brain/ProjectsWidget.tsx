import type { MouseEvent, ReactNode } from "react";
import Panel from "../ui/Panel";
import { STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectsWidget.css";

interface ProjectsWidgetProps {
    projects: LaboratoryProject[];
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function ProjectsDetail({ projects }: { projects: LaboratoryProject[] }) {
    if (projects.length === 0) {
        return <div className="projects-widget-detail-empty">No projects yet.</div>;
    }
    return (
        <div className="projects-widget-detail">
            {projects.map((project) => {
                const status = STATUS_META[project.status];
                return (
                    <div key={project.id} className="projects-widget-detail-item">
                        <span className="projects-widget-detail-dot" style={{ background: status.color }} />
                        <div className="projects-widget-detail-text">
                            <div className="projects-widget-detail-title">{project.name}</div>
                            <div className="projects-widget-detail-meta">{status.label} · {project.progress}%</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Reads the exact same shared project list Laboratory itself edits
 * (see state/laboratoryData.ts, owned by App.tsx) — no external API,
 * this is the user's own data. Same sharing pattern as Upcoming
 * Events/Notes.
 */
export default function ProjectsWidget({ projects, onOpenDetail }: ProjectsWidgetProps) {
    const activeCount = projects.filter((p) => p.status === "active").length;

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("📁 Projects", anchor, <ProjectsDetail projects={projects} />, 420);
    };

    let body: ReactNode;
    if (projects.length === 0) {
        body = <span className="projects-widget-muted">No active projects.</span>;
    } else {
        body = (
            <div className="projects-widget-body">
                <div className="projects-widget-title">{activeCount} active</div>
                <div className="projects-widget-meta">{projects.length} project{projects.length === 1 ? "" : "s"} total</div>
            </div>
        );
    }

    return <Panel title="📁 Projects" onClick={handleClick}>{body}</Panel>;
}
