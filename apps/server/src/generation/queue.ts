import fs from "node:fs";
import path from "node:path";
import {
    getGenerationJob, getStudioProject, markJobCancelled, markJobDone, markJobFailed,
    markJobProgress, markJobRunning, nextQueuedJob, type StoredGenerationJob,
} from "../db.js";
import { freeName } from "../projectFolder.js";
import { getEngine } from "./engines.js";
import "./comfyui.js";

/**
 * One runner, working through the queue.
 *
 * One at a time on purpose. Local generation saturates the GPU, so a
 * second concurrent job doesn't finish sooner — it makes both slower and
 * makes the progress of either meaningless. Cloud engines could run in
 * parallel, and when one is added this is the single place that changes.
 *
 * The runner is a loop that wakes on two things: a job being enqueued,
 * and a job finishing. Nothing polls the database on a timer, so an idle
 * studio does no work at all.
 *
 * Everything a job produces lands in the PROJECT'S FOLDER, under a name
 * nothing else is using. That is what makes a finished generation
 * footage with nothing to import: the bin already lists that folder, the
 * timeline already refers to files by name, and the export already
 * renders from them.
 */

/** The job the runner is on, so a cancel can reach it mid-flight. */
let current: number | null = null;
const cancelled = new Set<number>();
let looping = false;

export function isRunning(id: number): boolean {
    return current === id;
}

export function cancelJob(id: number): void {
    // Marked first so a job that hasn't started yet never starts, and
    // the running one sees the flag on its next look.
    markJobCancelled(id);
    cancelled.add(id);
}

/** Wakes the runner. Safe to call whenever anything is enqueued. */
export function kick(): void {
    if (looping) return;
    looping = true;
    void loop().finally(() => { looping = false; });
}

async function loop(): Promise<void> {
    for (;;) {
        const job = nextQueuedJob();
        if (!job) return;
        await runOne(job);
    }
}

/** A filename that says what made it and when, without being a UUID. */
function outputName(job: StoredGenerationJob, extension: string): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `gen-${job.id}-${stamp}${extension}`;
}

async function runOne(job: StoredGenerationJob): Promise<void> {
    current = job.id;
    markJobRunning(job.id);

    try {
        const engine = getEngine(job.engine);
        if (!engine) throw new Error(`No engine called "${job.engine}" is installed in this build.`);

        const project = getStudioProject(job.project_id);
        if (!project?.folder || !fs.existsSync(project.folder)) {
            throw new Error("This project's folder is gone, so there is nowhere to put the result.");
        }

        let params: Record<string, unknown> = {};
        try { params = JSON.parse(job.params_json) as Record<string, unknown>; } catch { params = {}; }

        const result = await engine.run({
            kind: job.kind,
            prompt: job.prompt,
            params,
            onProgress: (percent) => markJobProgress(job.id, percent),
            cancelled: () => cancelled.has(job.id),
        });

        // Checked again after the engine returns: a cancel that arrived
        // while the last bytes were downloading should not leave a file
        // in the folder that nobody asked for any more.
        if (cancelled.has(job.id)) {
            markJobCancelled(job.id);
            return;
        }

        const name = freeName(project.folder, outputName(job, result.extension));
        fs.writeFileSync(path.join(project.folder, name), result.bytes);
        markJobDone(job.id, name);
    } catch (e) {
        // A cancel surfaces as a thrown error from inside the engine,
        // and it is not a failure — the row already says cancelled.
        const stillCancelled = cancelled.has(job.id) || getGenerationJob(job.id)?.status === "cancelled";
        if (!stillCancelled) {
            markJobFailed(job.id, e instanceof Error ? e.message : "Generation failed for an unknown reason.");
        }
    } finally {
        cancelled.delete(job.id);
        current = null;
    }
}
