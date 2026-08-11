import { STATUS_META, type LaboratoryProject, type ProjectStatus } from "../../state/laboratoryProjects";
import "./AnalyticsPage.css";

interface AnalyticsPageProps {
    projects: LaboratoryProject[];
    noteCount: number;
    researchCount: number;
}

const STATUS_ORDER: ProjectStatus[] = ["active", "research", "paused", "completed"];

function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="analytics-tile">
            <span className="analytics-tile-value">{value}</span>
            <span className="analytics-tile-label">{label}</span>
        </div>
    );
}

/**
 * Global Analytics — every number here is computed live from state
 * Laboratory.tsx already owns (projects/tasks/tests/products/notes/
 * research), same "no fabricated widgets" discipline as ProjectGrid/
 * Overview. Nothing here is a real business metric (page views,
 * revenue, traffic) since there's no backend to source those from —
 * this is a rollup of what's actually being tracked, not a pretend
 * dashboard.
 */
export default function AnalyticsPage({ projects, noteCount, researchCount }: AnalyticsPageProps) {
    const totalTasks = projects.reduce((sum, p) => sum + p.tasks.length, 0);
    const doneTasks = projects.reduce((sum, p) => sum + p.tasks.filter((t) => t.done).length, 0);
    const taskRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;

    const totalTests = projects.reduce((sum, p) => sum + p.tests.length, 0);
    const passingTests = projects.reduce((sum, p) => sum + p.tests.filter((t) => t.status === "passing").length, 0);
    const testRate = totalTests > 0 ? Math.round((passingTests / totalTests) * 100) : null;

    const totalProducts = projects.reduce((sum, p) => sum + p.products.length, 0);
    const launchedProducts = projects.reduce((sum, p) => sum + p.products.filter((prod) => prod.stage === "launched").length, 0);

    const avgProgress = projects.length > 0
        ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
        : 0;

    const statusCounts = STATUS_ORDER.map((status) => ({
        status,
        count: projects.filter((p) => p.status === status).length,
    })).filter((entry) => entry.count > 0);

    const sortedProjects = [...projects].sort((a, b) => b.progress - a.progress);

    return (
        <div className="analytics-page">
            <div className="analytics-header">
                <span className="analytics-eyebrow">Laboratory</span>
                <h1>Analytics</h1>
            </div>

            <div className="analytics-tiles">
                <StatTile label="Projects" value={String(projects.length)} />
                <StatTile label="Avg. progress" value={`${avgProgress}%`} />
                <StatTile label="Tasks done" value={taskRate !== null ? `${taskRate}%` : "—"} />
                <StatTile label="Tests passing" value={testRate !== null ? `${testRate}%` : "—"} />
                <StatTile label="Products launched" value={`${launchedProducts}/${totalProducts || 0}`} />
                <StatTile label="Notes + Findings" value={String(noteCount + researchCount)} />
            </div>

            <div className="analytics-grid">
                <section className="analytics-panel">
                    <h2>Projects by status</h2>
                    {statusCounts.length === 0 ? (
                        <p className="analytics-empty">No projects yet.</p>
                    ) : (
                        <div className="analytics-status-list">
                            {statusCounts.map(({ status, count }) => {
                                const meta = STATUS_META[status];
                                const pct = Math.round((count / projects.length) * 100);
                                return (
                                    <div key={status} className="analytics-status-row">
                                        <span className="analytics-status-dot" style={{ background: meta.color }} />
                                        <span className="analytics-status-label">{meta.label}</span>
                                        <div className="analytics-status-track">
                                            <div className="analytics-status-fill" style={{ width: `${pct}%`, background: meta.color }} />
                                        </div>
                                        <span className="analytics-status-count">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="analytics-panel">
                    <h2>Progress by project</h2>
                    {sortedProjects.length === 0 ? (
                        <p className="analytics-empty">No projects yet.</p>
                    ) : (
                        <div className="analytics-status-list">
                            {sortedProjects.map((project) => (
                                <div key={project.id} className="analytics-status-row">
                                    <span className="analytics-status-label analytics-project-label">{project.name}</span>
                                    <div className="analytics-status-track">
                                        <div className="analytics-status-fill analytics-progress-fill" style={{ width: `${project.progress}%` }} />
                                    </div>
                                    <span className="analytics-status-count">{project.progress}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
