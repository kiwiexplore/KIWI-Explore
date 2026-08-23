import type { StudioProject } from "../../lib/projectsApi";

/**
 * Which video this thing belongs to.
 *
 * The same control in every section, because the question is the same
 * one everywhere: an idea, a script, a generated thumbnail and a post
 * are all FOR something, and a project with four videos in it is a
 * project where "which one" stops being obvious within a week.
 *
 * "Whole project" is a real answer, not an empty one. A note about the
 * series, a channel banner, a thumbnail style you're trying out —
 * these belong to the project and forcing them onto a video would file
 * them under the wrong thing.
 */
export default function VideoPicker({ project, value, onChange, label = "For" }: {
    project: StudioProject;
    value: number | null;
    onChange: (videoId: number | null) => void;
    label?: string;
}) {
    if (project.videos.length === 0) return null;

    return (
        <label className="vp">
            <span className="vp-label">{label}</span>
            <select
                className="vp-select"
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            >
                <option value="">Whole project</option>
                {project.videos.map((v) => (
                    <option key={v.id} value={v.id}>{v.title}</option>
                ))}
            </select>
        </label>
    );
}
