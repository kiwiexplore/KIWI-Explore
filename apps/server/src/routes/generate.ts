import { Router } from "express";
import { z } from "zod";
import {
    deleteGenerationJob, getGenerationJob, getStudioProject, getVideoProject,
    insertGenerationJob, listGenerationJobs,
} from "../db.js";
import { EngineUnavailableError, getEngine, listEngines } from "../generation/engines.js";
import { cancelJob, isRunning, kick } from "../generation/queue.js";
import "../generation/comfyui.js";

/**
 * The generation queue.
 *
 * Enqueue, look, cancel. The work itself happens in the runner (see
 * generation/queue.ts) and the row is what the client follows — the
 * same shape transcription already uses, and for the same reason: a job
 * takes minutes, which is far past any sensible request timeout.
 */
export const generateRouter = Router();

/** Reported separately from status, because a row can say 'running'
 *  while no process is actually running (a crash between the two). */
function withLive(job: ReturnType<typeof getGenerationJob>) {
    return job === null ? null : { ...job, live: isRunning(job.id) };
}

generateRouter.get("/engines", async (_req, res) => {
    // Each engine is asked whether it is usable, so the screen can say
    // "ComfyUI isn't running" before you write a prompt rather than
    // after. A slow check on one must not hide the others.
    const engines = await Promise.all(listEngines().map(async (engine) => {
        try {
            await engine.check();
            return { id: engine.id, label: engine.label, kinds: engine.kinds, where: engine.where, ready: true, why: null };
        } catch (e) {
            return {
                id: engine.id,
                label: engine.label,
                kinds: engine.kinds,
                where: engine.where,
                ready: false,
                why: e instanceof Error ? e.message : "Not available.",
            };
        }
    }));
    res.json({ engines });
});

generateRouter.get("/", (req, res) => {
    const projectId = req.query.projectId === undefined ? undefined : Number(req.query.projectId);
    if (projectId !== undefined && !Number.isInteger(projectId)) {
        res.status(400).json({ error: "Invalid projectId." });
        return;
    }
    res.json({ jobs: listGenerationJobs(projectId).map((j) => ({ ...j, live: isRunning(j.id) })) });
});

const enqueueSchema = z.object({
    projectId: z.number().int(),
    videoProjectId: z.number().int().nullable().optional(),
    kind: z.enum(["image", "video"]),
    engine: z.string().trim().min(1).max(60),
    prompt: z.string().trim().min(1).max(4000),
    /** How many to make from this one prompt. Each is its own job, so
     *  one can fail without taking the others with it. */
    count: z.number().int().min(1).max(8).default(1),
    params: z.record(z.string(), z.unknown()).default({}),
});

generateRouter.post("/", async (req, res) => {
    const parsed = enqueueSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "A projectId, kind, engine and prompt are required." });
        return;
    }
    const { projectId, videoProjectId, kind, engine: engineId, prompt, count, params } = parsed.data;

    const project = getStudioProject(projectId);
    if (!project) {
        res.status(404).json({ error: "No project with that id." });
        return;
    }
    if (!project.folder) {
        res.status(409).json({ error: "This project has no folder, so there is nowhere to put the result." });
        return;
    }
    if (videoProjectId != null && !getVideoProject(videoProjectId)) {
        res.status(400).json({ error: "No video with that id to attach this to." });
        return;
    }

    const engine = getEngine(engineId);
    if (!engine) {
        res.status(400).json({ error: `No engine called "${engineId}".` });
        return;
    }
    if (!engine.kinds.includes(kind)) {
        res.status(400).json({ error: `${engine.label} doesn't make ${kind}.` });
        return;
    }

    // Before, not during: an engine that isn't there should be a clear
    // refusal at the moment you press the button, not a job that goes to
    // 'failed' a second after the request succeeded.
    try {
        await engine.check();
    } catch (e) {
        if (e instanceof EngineUnavailableError) {
            res.status(503).json({ error: e.message });
            return;
        }
        res.status(502).json({ error: e instanceof Error ? e.message : "That engine couldn't be reached." });
        return;
    }

    const jobs = [];
    for (let i = 0; i < count; i += 1) {
        // Each variant gets its own seed unless one was pinned, so
        // "make me four" is four pictures rather than the same one.
        const seed = typeof params.seed === "number" ? params.seed + i : undefined;
        jobs.push(insertGenerationJob({
            projectId,
            videoProjectId: videoProjectId ?? null,
            kind,
            engine: engineId,
            prompt,
            params: seed === undefined ? params : { ...params, seed },
        }));
    }

    kick();
    res.status(202).json({ jobs: jobs.map((j) => ({ ...j, live: isRunning(j.id) })) });
});

generateRouter.post("/:id/cancel", (req, res) => {
    const id = Number(req.params.id);
    const job = Number.isInteger(id) ? getGenerationJob(id) : null;
    if (!job) {
        res.status(404).json({ error: "No job with that id." });
        return;
    }
    cancelJob(id);
    res.json({ job: withLive(getGenerationJob(id)) });
});

/** Takes a finished job off the list. The file it made stays — it is
 *  footage now, and belongs to the folder rather than to the job. */
generateRouter.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const job = getGenerationJob(id);
    if (job && (job.status === "queued" || job.status === "running")) {
        res.status(409).json({ error: "That one is still going — cancel it first." });
        return;
    }
    deleteGenerationJob(id);
    res.status(204).end();
});
