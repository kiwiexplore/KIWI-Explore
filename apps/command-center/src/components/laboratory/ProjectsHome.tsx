import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, Clapperboard, FolderKanban, Plus } from "lucide-react";
import type { StudioProjectsState } from "../../state/studioProjects";
import type { StudioProject } from "../../lib/projectsApi";
import "./GlobalBoard.css";
import StudioOverviewCharts from "./StudioOverviewCharts";
import "./ProjectsHome.css";

/**
 * How far along a project is: published videos against all of them,
 * with its ticked ideas counting for the part before any video exists.
 *
 * Deliberately crude. A percentage that tried to weigh scripting
 * against editing against publishing would be a number nobody could
 * check, and the bar is here to show movement, not to be accurate to
 * the day.
 */
function progressOf(p: StudioProject): number {
    const { videos, published, ideas, ideasDone } = p.counts;
    if (videos === 0) return ideas === 0 ? 0 : Math.round((ideasDone / ideas) * 25);
    return Math.round((published / videos) * 100);
}

function ProjectCard({ project, onOpen }: { project: StudioProject; onOpen: () => void }) {
    const { counts } = project;
    const percent = progressOf(project);

    return (
        <button type="button" className="ph-card" onClick={onOpen}>
            <div className="ph-card-head">
                <FolderKanban size={16} strokeWidth={1.75} />
                <span className="ph-card-title">{project.title}</span>
                {counts.failed > 0 && (
                    <span className="ph-card-alert" title={`${counts.failed} transcription${counts.failed === 1 ? "" : "s"} failed`}>
                        <AlertTriangle size={13} strokeWidth={2.5} />
                    </span>
                )}
            </div>

            {project.description && <p className="ph-card-desc">{project.description}</p>}

            <div className="ph-card-stats">
                <span><strong>{counts.videos}</strong> {counts.videos === 1 ? "video" : "videos"}</span>
                <span className="ph-card-dot" />
                <span><strong>{counts.published}</strong> published</span>
                <span className="ph-card-dot" />
                <span><strong>{counts.ideasDone}</strong>/{counts.ideas} ideas done</span>
            </div>

            <div className="ph-card-bar" aria-label={`${percent}% done`}>
                <span style={{ width: `${percent}%` }} />
            </div>
        </button>
    );
}

interface ProjectsHomeProps {
    projects: StudioProjectsState;
    onOpen: (id: number) => void;
}

/**
 * The studio's front door: your projects, nothing else.
 *
 * Everything a project contains — its ideas, its videos, the cut and
 * the publish — lives inside it rather than in a parallel set of
 * screens reached from a rail. There is one way in, and it is here.
 */
export default function ProjectsHome({ projects, onOpen }: ProjectsHomeProps) {
    const [title, setTitle] = useState("");

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        const created = await projects.create(title.trim());
        setTitle("");
        if (created) onOpen(created.id);
    };

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">KIWI Studio</span>
                    <h1>Projects</h1>
                </div>
                <form className="ph-new" onSubmit={handleCreate}>
                    <input
                        className="ph-new-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="A series, a channel, one film…"
                    />
                    <button type="submit" className="ph-new-btn" disabled={!title.trim()}>
                        <Plus size={15} strokeWidth={2} />
                        New project
                    </button>
                </form>
            </div>

            {projects.error && (
                <div className="ph-error">
                    <AlertTriangle size={14} strokeWidth={2} />
                    <span>{projects.error}</span>
                </div>
            )}

            {/* The overview belongs on the home page rather than behind
                a tab: it is the answer to "how is this going", which is
                the question you open the studio with. */}
            {!projects.loading && <StudioOverviewCharts projects={projects.projects} />}

            {projects.loading ? (
                <p className="ph-muted">Loading…</p>
            ) : projects.projects.length === 0 ? (
                <div className="global-board-empty">
                    <Clapperboard size={26} strokeWidth={1.25} />
                    <p>Nothing yet. A project holds the ideas, the videos and everything you do to them — name one above.</p>
                </div>
            ) : (
                <div className="ph-grid">
                    {projects.projects.map((p) => (
                        <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
                    ))}
                </div>
            )}

            {projects.projects.length > 0 && (
                <p className="ph-muted ph-footnote">
                    <Check size={12} strokeWidth={2.5} />
                    Progress counts published videos against all of them — ticked ideas carry it until the first one exists.
                </p>
            )}
        </div>
    );
}
