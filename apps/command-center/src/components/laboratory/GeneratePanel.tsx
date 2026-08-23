import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Check, Sparkles, Trash2, X } from "lucide-react";
import {
    cancelJob, enqueue, fetchEngines, fetchJobs, forgetJob,
    EngineUnavailableError, type Engine, type GenerationJob,
} from "../../lib/generateApi";
import { projectFileUrl } from "../../lib/projectsApi";
import "./GeneratePanel.css";

/**
 * Thumbnails and graphics, and the queue that makes them.
 *
 * STILLS ONLY, deliberately. Generating the video itself was here and
 * is gone: the footage in this studio comes from a camera, and the one
 * thing in the whole chain that can't be bought or copied is having
 * gone out and filmed it. Paying an API to invent a cave is the wrong
 * end of the work — and the same clip bought through somebody's API
 * costs more than buying it on their own site, so wrapping one would
 * have been work that made the result more expensive.
 *
 * What a still IS worth: a thumbnail, a title card, a diagram, a
 * background for a text overlay. Those are free on a local ComfyUI and
 * they are needed on every video.
 *
 * The file lands in the project's folder under its own name, so a
 * finished picture needs no import step — the bin already lists that
 * folder and the timeline already refers to files by name.
 */

const SIZES = [
    { label: "Thumbnail · 1280×720", width: 1280, height: 720 },
    { label: "16:9 · 1024×576", width: 1024, height: 576 },
    { label: "9:16 · 576×1024", width: 576, height: 1024 },
    { label: "1:1 · 1024×1024", width: 1024, height: 1024 },
];

/** Only while something is moving. An idle queue polls nothing. */
const POLL_MS = 1500;

interface GeneratePanelProps {
    projectId: number;
    /** Re-read the folder — a finished job put a file in it. */
    onFilesChanged: () => void;
}

export default function GeneratePanel({ projectId, onFilesChanged }: GeneratePanelProps) {
    const [engines, setEngines] = useState<Engine[] | null>(null);
    const [engineId, setEngineId] = useState<string>("");
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
                // Prefer one that can actually run; otherwise the first,
                // so the panel still explains itself rather than showing
                // an empty picker.
                setEngineId((found.find((e) => e.ready) ?? found[0])?.id ?? "");
            })
            .catch(() => { if (!cancelled) setEngines([]); });
        return () => { cancelled = true; };
    }, []);

    const read = useCallback(() => {
        void fetchJobs(projectId).then(setJobs).catch(() => { /* the next poll is a second away */ });
    }, [projectId]);

    useEffect(() => { read(); }, [read]);

    // A finished job put a file in the folder, and the page above this
    // one is showing that folder. Watched by counting what is done, so
    // the refresh happens once per finish rather than once per poll.
    const doneCount = jobs.filter((j) => j.status === "done").length;
    const lastDone = useRef<number | null>(null);
    useEffect(() => {
        if (lastDone.current !== null && doneCount > lastDone.current) onFilesChanged();
        lastDone.current = doneCount;
    }, [doneCount, onFilesChanged]);

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
            projectId,
            kind: "image",
            engine: engineId,
            prompt: prompt.trim(),
            count,
            params: { width: SIZES[size].width, height: SIZES[size].height },
        })
            .then(() => read())
            .catch((e) => setError(
                e instanceof EngineUnavailableError || e instanceof Error
                    ? e.message
                    : "Could not start that.",
            ))
            .finally(() => setSending(false));
    };

    const act = (work: Promise<unknown>) => {
        setError(null);
        void work.then(() => read()).catch((e) => setError(e instanceof Error ? e.message : "That didn't work."));
    };

    return (
        <section className="pd-panel">
            <div className="pd-panel-head">
                <h2>Thumbnails &amp; graphics</h2>
                {jobs.length > 0 && <span className="pd-count">{jobs.length}</span>}
                <span className="pd-panel-note">stills only — they land in this project's folder</span>
            </div>

            {engines !== null && engines.length === 0 && (
                <p className="pd-muted">No generation engine is built into this version.</p>
            )}

            {engine && !engine.ready && (
                <div className="gp-unavailable">
                    <AlertTriangle size={14} strokeWidth={2} />
                    <span>{engine.why}</span>
                </div>
            )}

            <form className="gp-form" onSubmit={submit}>
                <textarea
                    className="gp-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the picture — what is in it, how it is lit, what it has to say at a glance…"
                    rows={3}
                />

                <div className="gp-controls">
                    <label className="gp-field">
                        <span>Engine</span>
                        <select value={engineId} onChange={(e) => setEngineId(e.target.value)}>
                            {(engines ?? []).map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.label}{e.ready ? "" : " — not available"}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="gp-field">
                        <span>Size</span>
                        <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                            {SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                        </select>
                    </label>

                    <label className="gp-field">
                        <span>How many</span>
                        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                            {[1, 2, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>

                    <button
                        type="submit"
                        className="gp-go"
                        disabled={!prompt.trim() || sending || !engine?.ready}
                    >
                        <Sparkles size={13} strokeWidth={2} />
                        {sending ? "Queueing…" : "Generate"}
                    </button>
                </div>
            </form>

            {error && (
                <div className="gp-unavailable">
                    <AlertTriangle size={14} strokeWidth={2} />
                    <span>{error}</span>
                </div>
            )}

            {jobs.length > 0 && (
                <div className="gp-queue">
                    {jobs.map((job) => (
                        <JobRow
                            key={job.id}
                            job={job}
                            projectId={projectId}
                            onCancel={() => act(cancelJob(job.id))}
                            onForget={() => act(forgetJob(job.id))}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function JobRow({ job, projectId, onCancel, onForget }: {
    job: GenerationJob;
    projectId: number;
    onCancel: () => void;
    onForget: () => void;
}) {
    const running = job.status === "running";
    const pending = running || job.status === "queued";

    return (
        <div className={`gp-job gp-job-${job.status}`}>
            <span className="gp-job-thumb">
                {job.outputFile && job.kind === "image"
                    ? <img src={projectFileUrl(projectId, job.outputFile)} alt="" />
                    : job.status === "done" ? <Check size={13} strokeWidth={2.5} />
                        : job.status === "failed" ? <AlertTriangle size={13} strokeWidth={2.5} />
                            : job.status === "cancelled" ? <X size={13} strokeWidth={2.5} />
                                : <Sparkles size={13} strokeWidth={1.75} />}
            </span>

            <span className="gp-job-body">
                <span className="gp-job-prompt" title={job.prompt}>{job.prompt}</span>
                <span className="gp-job-meta">
                    {/* A row left claiming to be running after the server
                        restarted says so, rather than spinning forever. */}
                    {running && !job.live ? "interrupted — the server restarted"
                        : job.status === "failed" ? job.error
                            : job.status === "done" ? job.outputFile
                                : job.status === "cancelled" ? "cancelled"
                                    : running ? `${Math.round(job.progress)}%`
                                        : "waiting its turn"}
                </span>
                {running && job.live && (
                    <span className="gp-job-bar"><i style={{ width: `${job.progress}%` }} /></span>
                )}
            </span>

            {pending ? (
                <button type="button" className="pd-icon-btn" onClick={onCancel} aria-label="Cancel">
                    <X size={13} strokeWidth={2} />
                </button>
            ) : (
                <button type="button" className="pd-icon-btn" onClick={onForget} aria-label="Take off the list">
                    <Trash2 size={12} strokeWidth={1.75} />
                </button>
            )}
        </div>
    );
}
