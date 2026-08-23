import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
    AlertTriangle, ArrowRight, Check, Copy, FileText, Film, Image as ImageIcon,
    Music2, RefreshCw, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import type { StudioProject, ProjectFile } from "../../lib/projectsApi";
import {
    assignProjectFile, deleteProjectFile, projectFileUrl, uploadProjectFile,
} from "../../lib/projectsApi";
import type { VideoProject } from "../../lib/videoApi";
import type { StudioProjectsState } from "../../state/studioProjects";
import type { VideoStudioState } from "../../state/videoStudio";
import {
    createContentItem, deleteContentItem, updateContentItem, type ContentItem,
} from "../../lib/contentApi";
import {
    cancelJob, enqueue, fetchEngines, fetchJobs, forgetJob,
    EngineUnavailableError, type Engine, type GenerationJob,
} from "../../lib/generateApi";
import "./VideoWorkspace.css";

/**
 * Everything about one video, under the video.
 *
 * Footage, script, cut, thumbnail, posts — the five things you do, in
 * the order you do them. They were five sections of a flat project
 * page, which made them read as five things the PROJECT has rather than
 * five things a VIDEO needs, and left "which video is this for" to be
 * answered by a dropdown on every row.
 *
 * Reached only through a video, so it can't be answered wrongly.
 */

const KIND_ICON = { video: Film, audio: Music2, image: ImageIcon };

const SIZES = [
    { label: "Thumbnail · 1280×720", width: 1280, height: 720 },
    { label: "16:9 · 1024×576", width: 1024, height: 576 },
    { label: "9:16 · 576×1024", width: 576, height: 1024 },
];

const PIECES: { type: ContentItem["type"]; label: string; placeholder: string }[] = [
    { type: "facebook-post", label: "Facebook", placeholder: "The longer version — Facebook reads slower…" },
    { type: "instagram-post", label: "Instagram", placeholder: "Caption and hashtags…" },
    { type: "tiktok-post", label: "TikTok", placeholder: "Caption…" },
    { type: "ad", label: "Ad", placeholder: "The paid version of the pitch…" },
];

/** Only while something is moving. An idle queue polls nothing. */
const POLL_MS = 1500;

interface Props {
    video: VideoProject;
    project: StudioProject;
    projects: StudioProjectsState;
    videoStudio: VideoStudioState;
    onEdit: () => void;
    /** Hands the jobs up, so the chain on the row can read them. */
    onJobs: (jobs: GenerationJob[]) => void;
    after: <T>(work: Promise<T>) => void;
}

export default function VideoWorkspace({ video, project, projects, videoStudio, onEdit, onJobs, after }: Props) {
    return (
        <div className="vw">
            <FootageSection video={video} project={project} projects={projects} />
            <ScriptSection video={video} videoStudio={videoStudio} after={after} />
            <EditSection video={video} onEdit={onEdit} />
            <ThumbnailSection video={video} project={project} projects={projects} onJobs={onJobs} />
            <PublishSection video={video} videoStudio={videoStudio} after={after} />
        </div>
    );
}

function Section({ title, note, count, children }: {
    title: string;
    note?: string;
    count?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="vw-section">
            <div className="vw-head">
                <h3>{title}</h3>
                {count && <span className="vw-count">{count}</span>}
                {note && <span className="vw-note">{note}</span>}
            </div>
            {children}
        </section>
    );
}

/* ── footage ────────────────────────────────────────────────────────── */

/**
 * The material for THIS video.
 *
 * The files all live in one folder — the project's — because that is
 * how an editor works and how the timeline refers to them. What is per
 * video is which of them you are cutting from, and dropping a file here
 * files it under this video rather than leaving it to be sorted later.
 *
 * Anything unfiled is listed underneath rather than hidden, because a
 * file you copied in from Finder never passed through this box and
 * would otherwise be invisible from inside the video.
 */
function FootageSection({ video, project, projects }: {
    video: VideoProject;
    project: StudioProject;
    projects: StudioProjectsState;
}) {
    const [over, setOver] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const picker = useRef<HTMLInputElement>(null);

    const mine = project.files.filter((f) => f.videoProjectId === video.id);
    const loose = project.files.filter((f) => f.videoProjectId === null);

    const send = async (files: FileList | File[]) => {
        setError(null);
        // One at a time: these are whole video files, and a dozen
        // concurrent uploads of a gigabyte each is how a local server
        // starts refusing connections.
        for (const file of Array.from(files)) {
            setUploading(file.name);
            try {
                const listed = await uploadProjectFile(project.id, file);
                // Filed under this video straight away — the name the
                // server actually used, which may have a suffix if
                // something was already called that.
                const landed = listed.find((f) => f.name === file.name)
                    ?? listed.find((f) => f.name.startsWith(file.name.replace(/\.[^.]+$/, "")));
                if (landed) await assignProjectFile(project.id, landed.name, video.id);
            } catch (e) {
                setError(e instanceof Error ? e.message : `Could not add ${file.name}`);
            }
        }
        setUploading(null);
        projects.refresh();
    };

    const act = (work: Promise<unknown>) => {
        setError(null);
        void work.then(() => projects.refresh())
            .catch((e) => setError(e instanceof Error ? e.message : "That didn't work."));
    };

    const remove = (file: ProjectFile) => {
        const ok = confirm(
            `Delete ${file.name} from the project's folder?\n\n`
            + "This removes the file from your disk. Any cut that uses it will stop finding it.",
        );
        if (ok) act(deleteProjectFile(project.id, file.name));
    };

    const row = (file: ProjectFile, mineAlready: boolean) => {
        const Icon = KIND_ICON[file.kind];
        return (
            <div key={file.name} className="vw-file">
                <Icon size={13} strokeWidth={1.75} />
                <span className="vw-file-name">{file.name}</span>
                <span className="vw-file-size">{(file.bytes / 1_000_000).toFixed(1)} MB</span>
                <button
                    type="button"
                    className="vw-mini"
                    onClick={() => act(assignProjectFile(project.id, file.name, mineAlready ? null : video.id))}
                >
                    {mineAlready ? "Unfile" : "Use here"}
                </button>
                {mineAlready && (
                    <button type="button" className="vw-icon" onClick={() => remove(file)} aria-label={`Delete ${file.name}`}>
                        <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                )}
            </div>
        );
    };

    return (
        <Section title="Footage" count={`${mine.length}`} note="what this video is cut from">
            <div
                className={`vw-drop${over ? " vw-drop-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    setOver(false);
                    if (e.dataTransfer.files.length > 0) void send(e.dataTransfer.files);
                }}
                onClick={() => picker.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") picker.current?.click(); }}
            >
                <Upload size={15} strokeWidth={1.75} />
                <span>{uploading ? `Adding ${uploading}…` : "Drop footage, music or stills for this video"}</span>
                <input
                    ref={picker}
                    type="file"
                    multiple
                    accept="video/*,audio/*,image/*"
                    onChange={(e) => { if (e.target.files) void send(e.target.files); e.target.value = ""; }}
                    hidden
                />
            </div>

            {error && <p className="vw-error">{error}</p>}

            {mine.length === 0
                ? <p className="vw-muted">Nothing filed under this video yet.</p>
                : <div className="vw-files">{mine.map((f) => row(f, true))}</div>}

            {loose.length > 0 && (
                <>
                    <p className="vw-muted vw-loose-head">
                        In the project's folder but not filed under any video
                        <button type="button" className="vw-icon" onClick={() => projects.refresh()} aria-label="Re-read the folder">
                            <RefreshCw size={12} strokeWidth={2} />
                        </button>
                    </p>
                    <div className="vw-files">{loose.map((f) => row(f, false))}</div>
                </>
            )}
        </Section>
    );
}

/* ── script ─────────────────────────────────────────────────────────── */

/**
 * The script, written by either of you.
 *
 * The brief is the whole difference between a usable draft and a page
 * of nothing: asked for a script from a title alone, KIWI has only the
 * title. Say what it should cover and it has something to work from.
 * Writing one yourself stays exactly as available — the tick is what
 * turns CREATE green either way.
 */
function ScriptSection({ video, videoStudio, after }: {
    video: VideoProject;
    videoStudio: VideoStudioState;
    after: <T>(work: Promise<T>) => void;
}) {
    const [brief, setBrief] = useState("");
    const scripts = video.contentItems.filter((i) => i.type === "youtube-script");
    const busy = videoStudio.busy[video.id] === "script";

    const draft = (event: FormEvent) => {
        event.preventDefault();
        videoStudio.draftScript(video.id, brief.trim());
        setBrief("");
    };

    return (
        <Section title="Script" count={`${scripts.length}`} note="written by you, or drafted and then fixed">
            <form className="vw-brief" onSubmit={draft}>
                <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="What should it cover? — the more you say here, the less you rewrite afterwards"
                    rows={2}
                />
                <div className="vw-brief-actions">
                    <button type="submit" className="vw-ai" disabled={busy}>
                        <Sparkles size={12} strokeWidth={2} />
                        {busy ? "Writing…" : "Draft it with AI"}
                    </button>
                    <button
                        type="button"
                        className="vw-mini"
                        onClick={() => after(createContentItem(
                            // What you typed in the brief names it, not
                            // the video — every script in a video was
                            // called the same thing, which is no name
                            // at all. Nothing typed yet just says so.
                            "youtube-script", brief.trim() || "Untitled script", "", video.id,
                        ))}
                    >
                        Write it myself
                    </button>
                </div>
            </form>

            {scripts.length === 0
                ? <p className="vw-muted">No script yet.</p>
                : scripts.map((item) => <ScriptRow key={item.id} item={item} after={after} />)}
        </Section>
    );
}

function ScriptRow({ item, after }: { item: ContentItem; after: <T>(work: Promise<T>) => void }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(item.content);
    const [saved, setSaved] = useState(true);

    // A draft that arrives while this is shut replaces what is shown;
    // once you have typed, yours wins.
    const shown = saved ? item.content : text;

    const save = () => {
        setSaved(true);
        after(updateContentItem(item.id, { content: text }));
    };

    return (
        <div className="vw-script">
            <div className="vw-script-head">
                {/* The tick is what turns CREATE green. A script that
                    exists is work started; a script you have ticked is
                    work finished, and only you can say which. */}
                <button
                    type="button"
                    className={`vw-tick${item.done ? " vw-tick-on" : ""}`}
                    onClick={() => after(updateContentItem(item.id, { done: !item.done }))}
                    aria-label={item.done ? "Mark as not done" : "Mark as done"}
                >
                    {item.done && <Check size={11} strokeWidth={3.5} />}
                </button>
                <button type="button" className="vw-script-open" onClick={() => setOpen((o) => !o)}>
                    <FileText size={12} strokeWidth={1.75} />
                    <span className={item.done ? "vw-done" : ""}>{item.topic}</span>
                </button>
                <button
                    type="button"
                    className="vw-icon"
                    onClick={() => { if (confirm(`Delete the script "${item.topic}"?`)) after(deleteContentItem(item.id)); }}
                    aria-label="Delete this script"
                >
                    <Trash2 size={12} strokeWidth={1.75} />
                </button>
            </div>

            {open && (
                <div className="vw-script-body">
                    <textarea
                        value={shown}
                        onChange={(e) => { setText(e.target.value); setSaved(false); }}
                        onBlur={() => { if (!saved) save(); }}
                        placeholder="Write it here, or ask KIWI to draft one above."
                        rows={12}
                    />
                    <span className="vw-muted">{saved ? "Saved" : "Unsaved — click away to keep it"}</span>
                </div>
            )}
        </div>
    );
}

/* ── edit ───────────────────────────────────────────────────────────── */

function EditSection({ video, onEdit }: { video: VideoProject; onEdit: () => void }) {
    const stored = video.timeline as { clips?: unknown[] } | null;
    const clips = stored && Array.isArray(stored.clips) ? stored.clips.length : 0;

    return (
        <Section title="Edit" note="the timeline opens full width">
            <div className="vw-row">
                <span className={clips > 0 ? "vw-ok" : "vw-muted"}>
                    {clips === 0 ? "Timeline is empty" : `${clips} ${clips === 1 ? "clip" : "clips"} on the timeline`}
                </span>
                <span className={video.exported ? "vw-ok" : "vw-muted"}>
                    · {video.exported ? "exported" : "not exported yet"}
                </span>
                <span className="vw-spacer" />
                <button type="button" className="vw-mini vw-mini-go" onClick={onEdit}>
                    Open the editor
                    <ArrowRight size={11} strokeWidth={2} />
                </button>
            </div>
        </Section>
    );
}

/* ── thumbnail ──────────────────────────────────────────────────────── */

function ThumbnailSection({ video, project, projects, onJobs }: {
    video: VideoProject;
    project: StudioProject;
    projects: StudioProjectsState;
    onJobs: (jobs: GenerationJob[]) => void;
}) {
    const [engines, setEngines] = useState<Engine[] | null>(null);
    const [engineId, setEngineId] = useState("");
    const [prompt, setPrompt] = useState("");
    const [size, setSize] = useState(0);
    const [count, setCount] = useState(1);
    const [jobs, setJobs] = useState<GenerationJob[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    const engine = engines?.find((e) => e.id === engineId) ?? null;

    useEffect(() => {
        let cancelled = false;
        void fetchEngines()
            .then((found) => {
                if (cancelled) return;
                setEngines(found);
                setEngineId((found.find((e) => e.ready) ?? found[0])?.id ?? "");
            })
            .catch(() => { if (!cancelled) setEngines([]); });
        return () => { cancelled = true; };
    }, []);

    const read = useCallback(() => {
        void fetchJobs(project.id)
            .then((all) => {
                const mine = all.filter((j) => j.videoProjectId === video.id);
                setJobs(mine);
                onJobs(mine);
            })
            .catch(() => { /* the next poll is a second away */ });
    }, [project.id, video.id, onJobs]);

    useEffect(() => { read(); }, [read]);

    const doneCount = jobs.filter((j) => j.status === "done").length;
    const lastDone = useRef<number | null>(null);
    useEffect(() => {
        if (lastDone.current !== null && doneCount > lastDone.current) projects.refresh();
        lastDone.current = doneCount;
    }, [doneCount, projects]);

    const busy = jobs.some((j) => j.status === "queued" || j.status === "running");
    useEffect(() => {
        if (!busy) return;
        const timer = setInterval(read, POLL_MS);
        return () => clearInterval(timer);
    }, [busy, read]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!prompt.trim() || !engineId) return;
        setError(null);
        setSending(true);
        void enqueue({
            projectId: project.id,
            videoProjectId: video.id,
            kind: "image",
            engine: engineId,
            prompt: prompt.trim(),
            count,
            params: { width: SIZES[size].width, height: SIZES[size].height },
        })
            .then(() => read())
            .catch((e) => setError(
                e instanceof EngineUnavailableError || e instanceof Error ? e.message : "Could not start that.",
            ))
            .finally(() => setSending(false));
    };

    const act = (work: Promise<unknown>) => {
        setError(null);
        void work.then(() => read()).catch((e) => setError(e instanceof Error ? e.message : "That didn't work."));
    };

    return (
        <Section title="Thumbnail & graphics" count={jobs.length ? `${jobs.length}` : undefined} note="stills for this video">
            {engine && !engine.ready && (
                <p className="vw-error">{engine.why}</p>
            )}

            <form className="vw-brief" onSubmit={submit}>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the picture — what is in it, how it is lit, what it says at a glance…"
                    rows={2}
                />
                <div className="vw-brief-actions">
                    <select className="vw-select" value={engineId} onChange={(e) => setEngineId(e.target.value)}>
                        {(engines ?? []).map((e) => (
                            <option key={e.id} value={e.id}>{e.label}{e.ready ? "" : " — not available"}</option>
                        ))}
                    </select>
                    <select className="vw-select" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                        {SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                    </select>
                    <select className="vw-select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                        {[1, 2, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button type="submit" className="vw-ai" disabled={!prompt.trim() || sending || !engine?.ready}>
                        <Sparkles size={12} strokeWidth={2} />
                        {sending ? "Queueing…" : "Generate"}
                    </button>
                </div>
            </form>

            {error && <p className="vw-error">{error}</p>}

            {jobs.length > 0 && (
                <div className="vw-jobs">
                    {jobs.map((job) => (
                        <div key={job.id} className={`vw-job vw-job-${job.status}`}>
                            <span className="vw-job-thumb">
                                {job.outputFile
                                    ? <img src={projectFileUrl(project.id, job.outputFile)} alt="" />
                                    : job.status === "failed" ? <AlertTriangle size={12} strokeWidth={2.5} />
                                        : <Sparkles size={12} strokeWidth={1.75} />}
                            </span>
                            <span className="vw-job-body">
                                <span className="vw-job-prompt" title={job.prompt}>{job.prompt}</span>
                                <span className="vw-muted">
                                    {job.status === "failed" ? job.error
                                        : job.status === "done" ? job.outputFile
                                            : job.status === "running" ? `${Math.round(job.progress)}%`
                                                : job.status}
                                </span>
                            </span>
                            {(job.status === "queued" || job.status === "running")
                                ? (
                                    <button type="button" className="vw-icon" onClick={() => act(cancelJob(job.id))} aria-label="Cancel">
                                        <X size={12} strokeWidth={2} />
                                    </button>
                                )
                                : (
                                    <button type="button" className="vw-icon" onClick={() => act(forgetJob(job.id))} aria-label="Take off the list">
                                        <Trash2 size={11} strokeWidth={1.75} />
                                    </button>
                                )}
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

/* ── publish ────────────────────────────────────────────────────────── */

function PublishSection({ video, videoStudio, after }: {
    video: VideoProject;
    videoStudio: VideoStudioState;
    after: <T>(work: Promise<T>) => void;
}) {
    return (
        <Section title="Publish" note="written here, posted by you — nothing leaves this machine on its own">
            <div className="vw-row">
                <span className={video.exported ? "vw-ok" : "vw-muted"}>
                    {video.exported ? "Export is on disk, in Exports/" : "Nothing exported yet — cut it first"}
                </span>
                <span className="vw-spacer" />
                <button
                    type="button"
                    className={`vw-mini${video.stage === "published" ? " vw-mini-on" : ""}`}
                    onClick={() => {
                        void videoStudio
                            .update(video.id, { stage: video.stage === "published" ? "editing" : "published" })
                            .then(() => after(Promise.resolve()));
                    }}
                >
                    {video.stage === "published" ? "Published ✓" : "Mark as published"}
                </button>
            </div>

            <div className="vw-pieces">
                {PIECES.map((piece) => (
                    <PieceCard
                        key={piece.type}
                        piece={piece}
                        video={video}
                        busy={videoStudio.busy[video.id] === "content"}
                        onGenerate={() => videoStudio.generateContent(
                            video.id, piece.type as "ad" | "instagram-post" | "tiktok-post" | "facebook-post",
                        )}
                        after={after}
                    />
                ))}
            </div>
        </Section>
    );
}

function PieceCard({ piece, video, busy, onGenerate, after }: {
    piece: (typeof PIECES)[number];
    video: VideoProject;
    busy: boolean;
    onGenerate: () => void;
    after: <T>(work: Promise<T>) => void;
}) {
    const existing = video.contentItems.find((i) => i.type === piece.type) ?? null;
    const [text, setText] = useState("");
    const [dirty, setDirty] = useState(false);
    const [copied, setCopied] = useState(false);

    // A piece that arrives while this card is open replaces what is in
    // the box — unless you have typed into it, in which case yours wins.
    const shown = dirty ? text : (existing?.content ?? "");

    const save = () => {
        setDirty(false);
        if (existing) after(updateContentItem(existing.id, { content: text }));
        else after(createContentItem(piece.type, video.title, text, video.id));
    };

    return (
        <div className="vw-piece">
            <div className="vw-piece-head">
                <h4>{piece.label}</h4>
                <span className="vw-spacer" />
                <button type="button" className="vw-mini" onClick={onGenerate} disabled={busy}>
                    <Sparkles size={11} strokeWidth={2} />
                    {busy ? "Writing…" : existing ? "Rewrite" : "Generate"}
                </button>
                <button
                    type="button"
                    className="vw-icon"
                    disabled={!shown}
                    onClick={() => void navigator.clipboard.writeText(shown).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                    })}
                    aria-label={`Copy the ${piece.label} text`}
                >
                    {copied ? <Check size={11} strokeWidth={3} /> : <Copy size={11} strokeWidth={1.75} />}
                </button>
            </div>
            <textarea
                value={shown}
                onChange={(e) => { setText(e.target.value); setDirty(true); }}
                onBlur={() => { if (dirty) save(); }}
                placeholder={piece.placeholder}
                rows={5}
            />
        </div>
    );
}
