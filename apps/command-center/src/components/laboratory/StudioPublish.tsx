import { useState } from "react";
import { AlertTriangle, Check, Instagram, Megaphone, Music2 } from "lucide-react";
import type { VideoStudioState } from "../../state/videoStudio";
import { exportFileUrl, VIDEO_STAGES, type DerivedContentType, type VideoProject } from "../../lib/videoApi";
import { formatClock } from "../../lib/timecode";
import "./GlobalBoard.css";
import "./StudioPublish.css";

const DERIVED: { type: DerivedContentType; label: string; icon: typeof Megaphone }[] = [
    { type: "ad", label: "Ad", icon: Megaphone },
    { type: "instagram-post", label: "Instagram post", icon: Instagram },
    { type: "tiktok-post", label: "TikTok post", icon: Music2 },
];

interface StudioPublishProps {
    project: VideoProject;
    videoStudio: VideoStudioState;
}

/**
 * The last stage: what came out, and what goes with it.
 *
 * Publishing itself is a value you set. KIWI uploads nowhere and reads
 * nothing back, and this screen says so rather than implying a
 * connection by showing a button that only changes a database row.
 */
export default function StudioPublish({ project, videoStudio }: StudioPublishProps) {
    const [openId, setOpenId] = useState<number | null>(null);
    const busy = videoStudio.busy[project.id];

    const script = project.contentItems.find((i) => i.type === "youtube-script");
    const derived = project.contentItems.filter((i) => i.type !== "youtube-script");
    const material = project.transcriptStatus === "done" || script;

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">KIWI Studio</span>
                    <h1>{project.title}</h1>
                </div>
                <label className="studio-publish-stage">
                    <span>Stage</span>
                    <select value={project.stage} onChange={(e) => videoStudio.update(project.id, { stage: e.target.value as VideoProject["stage"] })}>
                        {VIDEO_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
            </div>

            <div className="global-board-notice">
                <AlertTriangle size={14} strokeWidth={2} />
                <span>
                    Stage is yours to set. KIWI doesn't upload to YouTube or Meta Ads and doesn't read numbers back,
                    so "published" here means you said so.
                </span>
            </div>

            <section className="studio-publish-panel">
                <h2>The film</h2>
                {project.clips.length > 0 ? (
                    <p className="studio-publish-line">
                        {project.clips.length} clip{project.clips.length === 1 ? "" : "s"} cut ·{" "}
                        <a href={exportFileUrl(project.id)} target="_blank" rel="noreferrer">open the last export</a>
                    </p>
                ) : (
                    <p className="studio-publish-line studio-publish-muted">
                        Nothing exported yet — that happens in the editor.
                    </p>
                )}
            </section>

            <section className="studio-publish-panel">
                <h2>Clips worth cutting</h2>
                {project.clips.length === 0 ? (
                    <p className="studio-publish-line studio-publish-muted">No clips found yet.</p>
                ) : (
                    <div className="studio-publish-clips">
                        {project.clips.map((clip, i) => (
                            <div key={`${clip.start}-${i}`} className="studio-publish-clip">
                                <span className="studio-publish-clip-time">{formatClock(clip.start)}–{formatClock(clip.end)}</span>
                                <span className="studio-publish-clip-label">{clip.label}</span>
                                {clip.file
                                    ? <span className="studio-publish-cut"><Check size={12} strokeWidth={3} />cut</span>
                                    : <span className="studio-publish-uncut">not cut</span>}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="studio-publish-panel">
                <h2>Posts and ads</h2>
                <div className="studio-publish-actions">
                    {DERIVED.map(({ type, label, icon: Icon }) => (
                        <div key={type} className="studio-publish-action">
                            <button
                                type="button"
                                onClick={() => videoStudio.generateContent(project.id, type)}
                                disabled={!material || busy === "content"}
                            >
                                <Icon size={13} strokeWidth={1.75} />
                                {busy === "content" ? "Writing…" : label}
                            </button>
                            {!material && (
                                <span className="studio-publish-reason">
                                    Needs a script or a finished transcript to work from.
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {derived.length > 0 && (
                    <div className="studio-publish-items">
                        {derived.map((item) => (
                            <div key={item.id} className="studio-publish-item">
                                <button type="button" onClick={() => setOpenId(openId === item.id ? null : item.id)}>
                                    <span className="studio-publish-item-type">{item.type.replace("-", " ")}</span>
                                    <span className="studio-publish-item-topic">{item.topic}</span>
                                    <span className="studio-publish-item-status">{item.status}</span>
                                </button>
                                {openId === item.id && <pre>{item.content}</pre>}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
