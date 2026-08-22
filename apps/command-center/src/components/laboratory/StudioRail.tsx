import { AlertTriangle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { StudioProject } from "../../lib/projectsApi";
import type { VideoProject } from "../../lib/videoApi";
import { PIPELINE } from "../../state/videoPipeline";
import "./StudioRail.css";

/**
 * How the work is going, beside the work rather than on top of it.
 *
 * These numbers used to sit in the header of Projects, which meant they
 * were only there on the one screen where you were least likely to need
 * them — you look at "how is this going" while you are in the middle of
 * something, not while standing at the front door. Living in a rail
 * means they are still there when you are inside a project.
 *
 * The same colour rules the charts were built with still hold: stages
 * are a SEQUENCE, so they wear a sequential ramp — one hue, lightness
 * rising with the step — rather than an assortment of hues. Published
 * leaves that ramp because it is a state rather than another step. The
 * two darkest steps fall below 3:1 against this surface, which is why
 * every bar carries its own number instead of leaning on a legend.
 */
const STAGE_COLOR: Record<string, string> = {
    idea: "#2a4a68",
    script: "#31648c",
    recorded: "#3881b3",
    transcribing: "#409fd9",
    editing: "#49C7FF",
    published: "#6EF3A5",
};

interface StudioRailProps {
    projects: StudioProject[];
    /** Every video in the studio, including any not in a project. */
    videos: VideoProject[];
    collapsed: boolean;
    onToggle: () => void;
}

function Tile({ value, label, tone }: { value: number | string; label: string; tone?: "good" | "alert" }) {
    return (
        <div className={`sr-tile${tone ? ` sr-tile-${tone}` : ""}`}>
            <span className="sr-tile-value">{value}</span>
            <span className="sr-tile-label">{label}</span>
        </div>
    );
}

function Bar({ name, value, max, color }: { name: string; value: number; max: number; color: string }) {
    return (
        <div className="sr-bar-row">
            <span className="sr-bar-name" title={name}>{name}</span>
            <span className="sr-bar-track">
                {value > 0 && <span className="sr-bar" style={{ width: `${(value / max) * 100}%`, background: color }} />}
            </span>
            <span className="sr-bar-value">{value}</span>
        </div>
    );
}

export default function StudioRail({ projects, videos, collapsed, onToggle }: StudioRailProps) {
    const published = videos.filter((v) => v.stage === "published").length;
    const failed = videos.filter((v) => v.transcriptStatus === "failed").length;
    const ideas = projects.reduce((n, p) => n + p.counts.ideas, 0);
    const ideasDone = projects.reduce((n, p) => n + p.counts.ideasDone, 0);

    const byStage = PIPELINE.map((step) => ({
        stage: step.stage,
        label: step.label,
        count: videos.filter((v) => v.stage === step.stage).length,
    }));
    const busiest = Math.max(1, ...byStage.map((s) => s.count));

    // Only projects that have videos can have a share published; one
    // with none would draw an empty bar that says nothing.
    const withVideos = projects.filter((p) => p.counts.videos > 0);
    const inAProject = projects.reduce((n, p) => n + p.counts.videos, 0);
    const loose = videos.length - inAProject;

    if (collapsed) {
        return (
            <aside className="sr sr-collapsed">
                <button type="button" className="sr-toggle" onClick={onToggle} aria-label="Show the overview">
                    <PanelLeftOpen size={15} strokeWidth={2} />
                </button>
                <span className="sr-collapsed-value">{videos.length}</span>
                <span className="sr-collapsed-label">videos</span>
                {failed > 0 && (
                    <span className="sr-collapsed-alert" title={`${failed} need you`}>
                        <AlertTriangle size={13} strokeWidth={2.5} />
                    </span>
                )}
            </aside>
        );
    }

    return (
        <aside className="sr">
            <div className="sr-head">
                <h2>Overview</h2>
                <button type="button" className="sr-toggle" onClick={onToggle} aria-label="Hide the overview">
                    <PanelLeftClose size={15} strokeWidth={2} />
                </button>
            </div>

            <div className="sr-tiles">
                <Tile value={videos.length} label="videos" />
                <Tile value={published} label="published" tone={published > 0 ? "good" : undefined} />
                <Tile value={videos.length - published} label="in progress" />
                <Tile value={ideas === 0 ? "—" : `${ideasDone}/${ideas}`} label="ideas done" />
                {failed > 0 && <Tile value={failed} label="need you" tone="alert" />}
            </div>

            <section className="sr-chart">
                <h3>Videos by stage</h3>
                <div className="sr-bars">
                    {byStage.map((s) => (
                        <Bar key={s.stage} name={s.label} value={s.count} max={busiest} color={STAGE_COLOR[s.stage]} />
                    ))}
                </div>
            </section>

            <section className="sr-chart">
                <h3>Published, by project</h3>
                {withVideos.length === 0 ? (
                    <p className="sr-empty">No videos in any project yet.</p>
                ) : (
                    <div className="sr-bars">
                        {withVideos.map((p) => (
                            <div key={p.id} className="sr-bar-row">
                                <span className="sr-bar-name" title={p.title}>{p.title}</span>
                                <span className="sr-bar-track">
                                    {p.counts.published > 0 && (
                                        <span
                                            className="sr-bar"
                                            style={{ width: `${(p.counts.published / p.counts.videos) * 100}%`, background: "#6EF3A5" }}
                                        />
                                    )}
                                </span>
                                <span className="sr-bar-value">{p.counts.published}/{p.counts.videos}</span>
                            </div>
                        ))}
                    </div>
                )}
                {/* The chart is per project and the tiles are per studio,
                    so they differ by whatever is in neither. Said here
                    rather than left for someone to notice by subtracting. */}
                {loose > 0 && (
                    <p className="sr-note">
                        {loose} {loose === 1 ? "video isn't" : "videos aren't"} in a project — they're listed on Projects.
                    </p>
                )}
            </section>
        </aside>
    );
}
