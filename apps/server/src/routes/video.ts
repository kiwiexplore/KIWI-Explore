import { Router } from "express";
import { z } from "zod";
import {
    deleteVideoProject, getContentItem, getVideoProject, insertContentItem, insertVideoProject,
    listContentItemsForVideo, listVideoProjects, saveVideoClips, updateVideoProject,
    VIDEO_STAGES, type StoredVideoProject,
} from "../db.js";
import {
    checkTranscriptionAvailable, isTranscribing, readTranscriptSegments, readTranscriptText,
    startTranscription, TranscriptionUnavailableError,
} from "../videoTranscriber.js";
import {
    findVideoClips, generateDerivedContent, generateVideoScript, AnthropicNotConfiguredError,
    DERIVED_CONTENT_TYPES, type DerivedContentType,
} from "../videoGenerator.js";

/**
 * Video Studio's CRUD plus the three pipeline steps that do real work
 * (transcribe, find clips, generate derived content).
 *
 * Every step that depends on an earlier one is checked HERE as well as
 * being disabled in the UI: a disabled button is a courtesy to whoever
 * is looking at the screen, not a guarantee about what reaches the
 * server.
 */
export const videoRouter = Router();

function fail(e: unknown, res: import("express").Response, fallback: string): void {
    if (e instanceof AnthropicNotConfiguredError) {
        res.status(503).json({ error: e.message });
        return;
    }
    console.error(`${fallback}:`, e);
    res.status(502).json({ error: e instanceof Error ? e.message : fallback });
}

/** Shared by every response so the client never has to merge two shapes. */
function withRelations(project: StoredVideoProject) {
    return {
        ...project,
        // Reported separately from transcript_status because a row can
        // say 'processing' while no process is actually running (a crash
        // between the two). failInterruptedTranscripts() cleans that up
        // at boot; this keeps the two facts distinguishable meanwhile.
        transcribing: isTranscribing(project.id),
        contentItems: listContentItemsForVideo(project.id),
    };
}

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) ? id : null;
}

videoRouter.get("/", (_req, res) => {
    res.json({ projects: listVideoProjects().map(withRelations) });
});

videoRouter.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const project = getVideoProject(id);
    if (!project) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    res.json({ project: withRelations(project) });
});

const createBodySchema = z.object({
    title: z.string().trim().min(1).max(200),
    sourceContentId: z.number().int().nullable().optional(),
});

videoRouter.post("/", (req, res) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "A title is required." });
        return;
    }
    const { title, sourceContentId } = parsed.data;
    // Checked rather than left to the FK: a foreign key violation would
    // surface as an opaque SQLite error, and "that script doesn't exist"
    // is something the person can act on.
    if (sourceContentId != null && !getContentItem(sourceContentId)) {
        res.status(400).json({ error: "No content item with that id to link as the source." });
        return;
    }
    res.json({ project: withRelations(insertVideoProject(title, sourceContentId ?? null)) });
});

const updateBodySchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    stage: z.enum(VIDEO_STAGES as [string, ...string[]]).optional(),
    sourceContentId: z.number().int().nullable().optional(),
    // An absolute path on the machine running this server. Emptying it
    // is allowed (null) — that's how you detach a file you pointed at
    // by mistake.
    sourceVideoPath: z.string().trim().max(1000).nullable().optional(),
});

videoRouter.patch("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const parsed = updateBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid title/stage/sourceContentId/sourceVideoPath." });
        return;
    }
    if (!getVideoProject(id)) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    const { sourceContentId } = parsed.data;
    if (sourceContentId != null && !getContentItem(sourceContentId)) {
        res.status(400).json({ error: "No content item with that id to link as the source." });
        return;
    }
    const updated = updateVideoProject(id, {
        ...parsed.data,
        stage: parsed.data.stage as StoredVideoProject["stage"] | undefined,
        // An empty string from a cleared input means "no file", not a
        // path of "".
        sourceVideoPath: parsed.data.sourceVideoPath === "" ? null : parsed.data.sourceVideoPath,
    });
    res.json({ project: updated ? withRelations(updated) : null });
});

videoRouter.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    // The generated ads/posts survive with video_project_id set to NULL
    // (ON DELETE SET NULL) — they stay visible in Content Hub rather
    // than disappearing along with the video.
    deleteVideoProject(id);
    res.status(204).end();
});

const scriptBodySchema = z.object({ brief: z.string().trim().max(2000).optional() });

videoRouter.post("/:id/script", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const project = getVideoProject(id);
    if (!project) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    const parsed = scriptBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid brief." });
        return;
    }
    try {
        const script = await generateVideoScript(project.title, parsed.data.brief ?? "");
        // The script is a content_item like any other, so it shows up in
        // Content Hub and can be scheduled there — it just also points
        // back at the video it belongs to.
        const item = insertContentItem("youtube-script", project.title, script, id);
        // Only nudge the stage forward from 'idea'; a video already
        // recorded or published shouldn't be dragged back to 'script'
        // because someone regenerated the text.
        const updated = project.stage === "idea"
            ? updateVideoProject(id, { stage: "script", sourceContentId: project.source_content_id ?? item.id })
            : getVideoProject(id);
        res.json({ item, project: updated ? withRelations(updated) : null });
    } catch (e) {
        fail(e, res, "Could not draft a script");
    }
});

videoRouter.post("/:id/transcribe", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const project = getVideoProject(id);
    if (!project) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    if (!project.source_video_path) {
        res.status(400).json({ error: "This project has no video file path yet — add one first." });
        return;
    }
    if (isTranscribing(id)) {
        res.status(409).json({ error: "A transcription is already running for this project." });
        return;
    }
    try {
        // Before, not during: a missing binary should be a clear 503 with
        // install instructions, not a row that goes to 'failed' a moment
        // after the request succeeded.
        await checkTranscriptionAvailable();
    } catch (e) {
        if (e instanceof TranscriptionUnavailableError) {
            res.status(503).json({ error: e.message });
            return;
        }
        fail(e, res, "Could not start transcription");
        return;
    }
    startTranscription(id, project.source_video_path);
    // 202: accepted and running. The client follows transcript_status
    // from here rather than holding a request open for minutes.
    const updated = getVideoProject(id);
    res.status(202).json({ project: updated ? withRelations(updated) : null });
});

videoRouter.post("/:id/clips", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const project = getVideoProject(id);
    if (!project) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    if (project.transcript_status !== "done" || !project.transcript_path) {
        res.status(409).json({
            error: `Finding clips needs a finished transcript — this project's transcript is "${project.transcript_status}".`,
        });
        return;
    }
    try {
        const transcript = readTranscriptText(project.transcript_path);
        if (!transcript.trim()) {
            res.status(409).json({ error: "The transcript file is empty or unreadable — run the transcription again." });
            return;
        }
        const clips = await findVideoClips(project.title, readTranscriptSegments(id), transcript);
        const updated = saveVideoClips(id, JSON.stringify(clips));
        res.json({ clips, project: updated ? withRelations(updated) : null });
    } catch (e) {
        fail(e, res, "Could not find clips");
    }
});

const derivedBodySchema = z.object({
    type: z.enum(DERIVED_CONTENT_TYPES as [string, ...string[]]),
});

videoRouter.post("/:id/content", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const project = getVideoProject(id);
    if (!project) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    const parsed = derivedBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: `type must be one of: ${DERIVED_CONTENT_TYPES.join(", ")}.` });
        return;
    }

    // What the video actually says beats what it planned to say, so a
    // finished transcript wins over the script. With neither there's
    // nothing to promote yet, and inventing an ad from a bare title
    // would produce confident nonsense.
    const transcript = project.transcript_status === "done" && project.transcript_path
        ? readTranscriptText(project.transcript_path)
        : "";
    const script = listContentItemsForVideo(id).find((item) => item.type === "youtube-script")?.content ?? "";
    const material = transcript.trim() || script.trim();
    if (!material) {
        res.status(409).json({ error: "Nothing to work from yet — draft a script or finish a transcript first." });
        return;
    }

    try {
        const type = parsed.data.type as DerivedContentType;
        const content = await generateDerivedContent(type, project.title, material);
        const item = insertContentItem(type, project.title, content, id);
        res.json({ item, project: withRelations(getVideoProject(id) as StoredVideoProject) });
    } catch (e) {
        fail(e, res, "Could not generate that piece");
    }
});
