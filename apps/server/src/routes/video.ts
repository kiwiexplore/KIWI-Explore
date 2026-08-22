import { Router } from "express";
import { z } from "zod";
import {
    deleteVideoProject, getContentItem, getVideoProject, insertContentItem, insertVideoProject,
    listContentItemsForVideo, listVideoProjects, saveVideoClips, updateVideoProject,
    getLabNote, saveTimeline, getStudioProject, VIDEO_STAGES, type StoredVideoProject,
} from "../db.js";
import {
    checkTranscriptionAvailable, isTranscribing, readTranscriptSegments, readTranscriptText,
    startTranscription, TranscriptionUnavailableError,
} from "../videoTranscriber.js";
import {
    findVideoClips, generateDerivedContent, generateVideoScript, AnthropicNotConfiguredError,
    DERIVED_CONTENT_TYPES, type DerivedContentType, type VideoClip,
} from "../videoGenerator.js";
import { checkClippingAvailable, cutClip, ClippingUnavailableError } from "../videoClipper.js";
import { resolveProjectFile } from "../projectFolder.js";
import {
    checkExportAvailable, renderExport, uploadsDir, exportsDir,
    ExportUnavailableError, type ExportRequest,
} from "../videoExport.js";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
    /** The idea or trend this video came out of, set at birth. */
    sourceNoteId: z.number().int().nullable().optional(),
    /** The project it belongs to. */
    projectId: z.number().int().nullable().optional(),
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
    const { sourceNoteId } = parsed.data;
    if (sourceNoteId != null && !getLabNote(sourceNoteId)) {
        res.status(400).json({ error: "No note with that id to link as the source." });
        return;
    }
    const created = insertVideoProject(title, sourceContentId ?? null);
    // Set straight after insert rather than threading another argument
    // through: the column is optional and this is the only caller that
    // ever fills it at creation.
    const { projectId } = parsed.data;
    const project = (sourceNoteId != null || projectId != null)
        ? updateVideoProject(created.id, { sourceNoteId, projectId })
        : created;
    res.json({ project: withRelations(project ?? created) });
});

const updateBodySchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    stage: z.enum(VIDEO_STAGES as [string, ...string[]]).optional(),
    sourceContentId: z.number().int().nullable().optional(),
    // An absolute path on the machine running this server. Emptying it
    // is allowed (null) — that's how you detach a file you pointed at
    // by mistake.
    sourceVideoPath: z.string().trim().max(1000).nullable().optional(),
    // 'auto', or an ISO 639-1 code. Kept loose rather than an enum so a
    // language nobody listed still works — whisper knows far more of
    // them than any list here would.
    language: z.string().trim().max(12).optional(),
    // The idea or trend this video grew out of.
    sourceNoteId: z.number().int().nullable().optional(),
    projectId: z.number().int().nullable().optional(),
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
    const { sourceContentId, sourceNoteId } = parsed.data;
    if (sourceContentId != null && !getContentItem(sourceContentId)) {
        res.status(400).json({ error: "No content item with that id to link as the source." });
        return;
    }
    // Checked rather than left to the foreign key: a constraint
    // violation surfaces as an opaque SQLite error, where "that note
    // doesn't exist" is something a person can act on.
    if (sourceNoteId != null && !getLabNote(sourceNoteId)) {
        res.status(400).json({ error: "No note with that id to link as the source." });
        return;
    }
    // Same reasoning, and this one is reachable from the UI: moving a
    // loose video into a project is a picked id arriving over the wire.
    if (parsed.data.projectId != null && !getStudioProject(parsed.data.projectId)) {
        res.status(400).json({ error: "No project with that id to move this video into." });
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

/**
 * The transcript, with its timestamps, for the editor to turn into
 * subtitles.
 *
 * The whisper JSON has been sitting next to every finished transcript
 * since transcription landed — it was written for the clip finder and
 * never had a way out. Subtitles are the same data read differently.
 */
videoRouter.get("/:id/transcript", (req, res) => {
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
            error: `No finished transcript to read — this project's transcript is "${project.transcript_status}".`,
        });
        return;
    }
    res.json({
        text: readTranscriptText(project.transcript_path),
        segments: readTranscriptSegments(id),
        language: project.language,
    });
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
        const script = await generateVideoScript(project.title, parsed.data.brief ?? "", project.language);
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

/**
 * `file` is a name in the video's own project folder, not a path.
 *
 * That is the same identity the bin lists, the browser plays, the saved
 * timeline points at and the export renders from — so "transcribe what
 * I am watching" is a name the editor already has, rather than an
 * absolute path somebody had to type into a field.
 */
const transcribeBodySchema = z.object({
    file: z.string().trim().min(1).max(400).optional(),
    language: z.string().trim().max(12).optional(),
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
    const parsed = transcribeBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid file or language." });
        return;
    }

    // A named file wins over whatever path the row is carrying: it is
    // what was just picked, and the row's path may be from before this
    // video was in a project at all.
    let sourcePath = project.source_video_path;
    if (parsed.data.file) {
        const owner = project.project_id === null ? null : getStudioProject(project.project_id);
        if (!owner) {
            res.status(409).json({ error: "This video isn't in a project, so there is no folder to take that file from." });
            return;
        }
        // resolveProjectFile is the boundary — a name that climbs out of
        // the folder is refused rather than normalised into a path to
        // somewhere else on the disk.
        const resolved = resolveProjectFile(owner.folder, parsed.data.file);
        if (!resolved) {
            res.status(400).json({ error: `There is no file called "${parsed.data.file}" in ${owner.title}'s folder.` });
            return;
        }
        sourcePath = resolved;
    }
    if (!sourcePath) {
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
    // Written only once the job is certainly going to run. A request
    // that answered 503 because whisper isn't installed should leave the
    // row exactly as it found it.
    const language = parsed.data.language ?? project.language;
    updateVideoProject(id, { sourceVideoPath: sourcePath, language });
    startTranscription(id, sourcePath, language);
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
        const clips = await findVideoClips(project.title, readTranscriptSegments(id), transcript, project.language);
        const updated = saveVideoClips(id, JSON.stringify(clips));
        res.json({ clips, project: updated ? withRelations(updated) : null });
    } catch (e) {
        fail(e, res, "Could not find clips");
    }
});

/**
 * Cuts one suggested clip into a real file and records where it went.
 *
 * Deliberately one at a time: a clip re-encodes in a few seconds, which
 * fits in a request, and cutting them individually means one bad clip
 * doesn't take the rest of the batch with it.
 */
videoRouter.post("/:id/clips/:index/cut", async (req, res) => {
    const id = parseId(req.params.id);
    const index = parseId(req.params.index);
    if (id === null || index === null || index < 0) {
        res.status(400).json({ error: "Invalid id or clip index." });
        return;
    }
    const project = getVideoProject(id);
    if (!project) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    if (!project.source_video_path) {
        res.status(409).json({ error: "This project has no video file to cut from." });
        return;
    }

    let clips: VideoClip[] = [];
    try {
        clips = project.clips_json ? (JSON.parse(project.clips_json) as VideoClip[]) : [];
    } catch {
        clips = [];
    }
    if (!clips[index]) {
        res.status(409).json({ error: "There's no clip at that position — find clips again." });
        return;
    }

    try {
        await checkClippingAvailable();
    } catch (e) {
        if (e instanceof ClippingUnavailableError) {
            res.status(503).json({ error: e.message });
            return;
        }
        fail(e, res, "Could not cut that clip");
        return;
    }

    try {
        const file = await cutClip(id, project.source_video_path, clips[index], index);
        clips[index] = { ...clips[index], file };
        const updated = saveVideoClips(id, JSON.stringify(clips));
        res.json({ project: updated ? withRelations(updated) : null });
    } catch (e) {
        fail(e, res, "Could not cut that clip");
    }
});

/**
 * Media the editor imported, so the server can render with it.
 *
 * Raw body rather than multipart: one file per request, the name and
 * type in headers, and nothing to parse. A multipart parser would be a
 * dependency earning its keep only here.
 */
videoRouter.post("/:id/media", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null || !getVideoProject(id)) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    const declared = String(req.header("x-file-name") ?? "media");
    const extension = (path.extname(declared).match(/^\.[A-Za-z0-9]{1,5}$/) ?? [".bin"])[0];
    const file = `${randomUUID()}${extension}`;

    fs.mkdirSync(uploadsDir, { recursive: true });
    const target = path.join(uploadsDir, file);
    const sink = fs.createWriteStream(target);

    req.pipe(sink);
    sink.on("finish", () => {
        if (fs.statSync(target).size === 0) {
            fs.rmSync(target, { force: true });
            res.status(400).json({ error: "That upload arrived empty." });
            return;
        }
        res.json({ file, name: declared });
    });
    // A half-written file is worse than none: it would render as a
    // corrupt clip rather than as a failure.
    sink.on("error", (e) => {
        fs.rmSync(target, { force: true });
        res.status(500).json({ error: `Could not store that file: ${e.message}` });
    });
});

const exportClipSchema = z.object({
    file: z.string().min(1).max(200),
    start: z.number().min(0),
    duration: z.number().positive(),
    offset: z.number().min(0),
    kind: z.enum(["video", "audio"]),
});

const exportBodySchema = z.object({
    clips: z.array(exportClipSchema).min(1),
    texts: z.array(z.object({
        text: z.string().max(500),
        start: z.number().min(0),
        duration: z.number().positive(),
    })).default([]),
    width: z.number().int().min(16).max(7680).default(1920),
    height: z.number().int().min(16).max(4320).default(1080),
    crossfade: z.number().min(0).max(5).default(0),
});

videoRouter.post("/:id/export", async (req, res) => {
    const id = parseId(req.params.id);
    const video = id === null ? null : getVideoProject(id);
    if (!video) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    const parsed = exportBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "The timeline sent for export doesn't look right." });
        return;
    }
    try {
        await checkExportAvailable();
    } catch (e) {
        if (e instanceof ExportUnavailableError) {
            res.status(503).json({ error: e.message });
            return;
        }
        fail(e, res, "Could not export");
        return;
    }
    try {
        // Media resolves inside the owning project's folder, and the
        // render lands in its Exports — beside the footage rather than
        // in the app's private store.
        const owner = video.project_id ? getStudioProject(video.project_id) : null;
        const result = await renderExport(video.id, parsed.data as ExportRequest, owner?.folder || undefined);
        res.json({ file: result.file, bytes: fs.statSync(result.file).size, warnings: result.warnings });
    } catch (e) {
        fail(e, res, "Could not export");
    }
});

/** The rendered file itself, for playing back or saving. */
videoRouter.get("/:id/export/file", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const file = path.join(exportsDir, `${id}.mp4`);
    if (!fs.existsSync(file)) {
        res.status(404).json({ error: "Nothing has been exported for this project yet." });
        return;
    }
    res.sendFile(file);
});

/**
 * The cut, saved whole.
 *
 * Deliberately not validated field by field: the timeline's shape is
 * the editor's business and will change as it grows, and a schema here
 * would have to be updated in lockstep or silently reject work. It is
 * stored as text and handed back as text; the size cap is the only
 * thing this needs an opinion about.
 */
videoRouter.put("/:id/timeline", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null || !getVideoProject(id)) {
        res.status(404).json({ error: "No video project with that id." });
        return;
    }
    const json = JSON.stringify(req.body ?? {});
    if (json.length > 4_000_000) {
        res.status(413).json({ error: "That timeline is too large to store." });
        return;
    }
    saveTimeline(id, json);
    res.status(204).end();
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
        const content = await generateDerivedContent(type, project.title, material, project.language);
        const item = insertContentItem(type, project.title, content, id);
        res.json({ item, project: withRelations(getVideoProject(id) as StoredVideoProject) });
    } catch (e) {
        fail(e, res, "Could not generate that piece");
    }
});
