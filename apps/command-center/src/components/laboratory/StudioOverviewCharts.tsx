import type { StudioProject } from "../../lib/projectsApi";
import { PIPELINE } from "../../state/videoPipeline";
import "./StudioOverviewCharts.css";

/**
 * How the work is going, from the work itself.
 *
 * Stages are a SEQUENCE, not a set of categories, so they wear a
 * sequential ramp — one hue, lightness rising with the step — rather
 * than an assortment of hues. Published leaves that ramp deliberately:
 * it is a state rather than another step, so it takes the status
 * colour, and it is labelled like every other bar so the colour is
 * never carrying the meaning alone.
 *
 * The two darkest steps fall below 3:1 against this surface, which is
 * why every bar is directly labelled rather than relying on a legend.
 */
const STAGE_COLOR: Record<string, string> = {
    idea: "#2a4a68",
    script: "#31648c",
    recorded: "#3881b3",
    transcribing: "#409fd9",
    editing: "#49C7FF",
    published: "#6EF3A5",
};

interface OverviewChartsProps {
    projects: StudioProject[];
}

function Tile({ value, label, tone }: { value: number | string; label: string; tone?: "good" | "alert" }) {
    return (
        <div className={`soc-tile${tone ? ` soc-tile-${tone}` : ""}`}>
            <span className="soc-tile-value">{value}</span>
            <span className="soc-tile-label">{label}</span>
        </div>
    );
}

export default function StudioOverviewCharts({ projects }: OverviewChartsProps) {
    const videos = projects.flatMap((p) => p.videos);
    if (projects.length === 0) return null;

    const byStage = PIPELINE.map((step) => ({
        stage: step.stage,
        label: step.label,
        count: videos.filter((v) => v.stage === step.stage).length,
    }));
    const busiest = Math.max(1, ...byStage.map((s) => s.count));

    const published = videos.filter((v) => v.stage === "published").length;
    const failed = videos.filter((v) => v.transcriptStatus === "failed").length;
    const ideas = projects.reduce((n, p) => n + p.counts.ideas, 0);
    const ideasDone = projects.reduce((n, p) => n + p.counts.ideasDone, 0);

    // Only projects that have videos can have a share published; one
    // with none would draw an empty bar that says nothing.
    const withVideos = projects.filter((p) => p.counts.videos > 0);

    return (
        <div className="soc">
            <div className="soc-tiles">
                <Tile value={videos.length} label="videos" />
                <Tile value={published} label="published" tone={published > 0 ? "good" : undefined} />
                <Tile value={videos.length - published} label="in progress" />
                <Tile value={ideas === 0 ? "—" : `${ideasDone}/${ideas}`} label="ideas done" />
                {failed > 0 && <Tile value={failed} label="need you" tone="alert" />}
            </div>

            <div className="soc-charts">
                <figure className="soc-chart">
                    <figcaption>Videos by stage</figcaption>
                    <div className="soc-bars">
                        {byStage.map((s) => (
                            <div key={s.stage} className="soc-bar-row">
                                <span className="soc-bar-name">{s.label}</span>
                                <div className="soc-bar-track">
                                    {s.count > 0 && (
                                        <span
                                            className="soc-bar"
                                            style={{
                                                width: `${(s.count / busiest) * 100}%`,
                                                background: STAGE_COLOR[s.stage],
                                            }}
                                        />
                                    )}
                                </div>
                                <span className="soc-bar-value">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </figure>

                <figure className="soc-chart">
                    <figcaption>Published, by project</figcaption>
                    {withVideos.length === 0 ? (
                        <p className="soc-empty">No videos in any project yet.</p>
                    ) : (
                        <div className="soc-bars">
                            {withVideos.map((p) => {
                                const percent = Math.round((p.counts.published / p.counts.videos) * 100);
                                return (
                                    <div key={p.id} className="soc-bar-row">
                                        <span className="soc-bar-name" title={p.title}>{p.title}</span>
                                        <div className="soc-bar-track">
                                            {percent > 0 && (
                                                <span className="soc-bar" style={{ width: `${percent}%`, background: "#6EF3A5" }} />
                                            )}
                                        </div>
                                        <span className="soc-bar-value">{p.counts.published}/{p.counts.videos}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </figure>
            </div>
        </div>
    );
}
