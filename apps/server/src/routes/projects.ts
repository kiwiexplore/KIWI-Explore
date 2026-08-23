import { Router } from "express";
import { z } from "zod";
import {
    deleteStudioProject, getStudioProject, insertStudioProject, listStudioProjects,
    listLabNotesForProject, listVideoProjectsForProject, updateStudioProject,
    listContentItemsForVideo, listUnfiledContentItems,
} from "../db.js";
import {
    createProjectFolder, listProjectFiles, resolveProjectFile, isMediaName, freeName,
    folderWeight, trashProjectFolder,
} from "../projectFolder.js";
import { hasExport } from "../videoExport.js";
import fs from "node:fs";
import path from "node:path";

/**
 * Projects: the thing you work on, and everything under it.
 *
 * A GET returns the project with its notes and its videos rather than
 * making the client stitch three requests together — the screen always
 * wants all three, and one round trip means they can never disagree
 * about what exists.
 */
export const projectsRouter = Router();

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) ? id : null;
}

/** A project's own progress, from the videos actually under it. */
function summarise(projectId: number) {
    // Each video carries what has been written for it, so the project
    // can show its scripts without the client fetching per video.
    const project = getStudioProject(projectId);
    // `exported` is read here as well as on /api/video, because the two
    // routes build the same shape and a screen that had it from one and
    // not the other would show the chain differently depending on which
    // request filled it.
    const videos = listVideoProjectsForProject(projectId)
        .map((v) => ({
            ...v,
            contentItems: listContentItemsForVideo(v.id),
            exported: hasExport(v.id, project?.folder || undefined),
        }));
    const notes = listLabNotesForProject(projectId);
    const files = project ? listProjectFiles(project.folder) : [];
    // Scripts written before they were filed under a video. Without
    // these the Scripts panel would silently drop everything you
    // started but hadn't assigned yet.
    const scripts = listUnfiledContentItems().filter((i) => i.type === "youtube-script");
    return {
        videos,
        notes,
        files,
        scripts,
        counts: {
            videos: videos.length,
            published: videos.filter((v) => v.stage === "published").length,
            failed: videos.filter((v) => v.transcript_status === "failed").length,
            ideas: notes.length,
            ideasDone: notes.filter((n) => n.done === 1).length,
            files: files.length,
        },
    };
}

projectsRouter.get("/", (_req, res) => {
    res.json({
        projects: listStudioProjects().map((p) => ({ ...p, ...summarise(p.id) })),
    });
});

projectsRouter.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const project = getStudioProject(id);
    if (!project) {
        res.status(404).json({ error: "No project with that id." });
        return;
    }
    res.json({ project: { ...project, ...summarise(id) } });
});

const bodySchema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(4000).optional(),
});

projectsRouter.post("/", (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "A title is required." });
        return;
    }
    // The folder is made with the project, not on first import: a
    // project you can't put files into isn't one.
    const folder = createProjectFolder(parsed.data.title);
    const created = insertStudioProject(parsed.data.title, parsed.data.description ?? "", folder);
    res.json({ project: { ...created, ...summarise(created.id) } });
});

projectsRouter.patch("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const parsed = bodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid title or description." });
        return;
    }
    if (!getStudioProject(id)) {
        res.status(404).json({ error: "No project with that id." });
        return;
    }
    const updated = updateStudioProject(id, parsed.data);
    res.json({ project: updated ? { ...updated, ...summarise(id) } : null });
});

/**
 * A file from the project's folder, with range support so a browser can
 * seek in it — without that, the editor can only play a video from the
 * start, which makes a timeline useless.
 */
projectsRouter.get("/:id/files/:name", (req, res) => {
    const id = parseId(req.params.id);
    const project = id === null ? null : getStudioProject(id);
    if (!project) {
        res.status(404).json({ error: "No project with that id." });
        return;
    }
    const file = resolveProjectFile(project.folder, req.params.name);
    if (!file) {
        res.status(404).json({ error: "That file isn't in this project's folder." });
        return;
    }
    // sendFile handles Range, Content-Type and caching headers; doing it
    // by hand here would be re-implementing them slightly worse.
    res.sendFile(file);
});

/**
 * Puts a file INTO the project's folder.
 *
 * Dropping it in from Finder has always worked and still does — this is
 * the same act from the other side of the screen, for the times you are
 * already looking at the project. The file lands in the same folder,
 * under its own name, and from that moment it is indistinguishable from
 * one you copied there yourself. Nothing is stored twice.
 *
 * Raw body with the name in a header, matching the media upload the
 * editor already uses: one file per request, nothing to parse.
 */
projectsRouter.post("/:id/files", (req, res) => {
    const id = parseId(req.params.id);
    const project = id === null ? null : getStudioProject(id);
    if (!project || !project.folder) {
        res.status(404).json({ error: "No project with that id, or it has no folder." });
        return;
    }
    if (!fs.existsSync(project.folder)) {
        res.status(409).json({ error: `This project's folder is gone: ${project.folder}` });
        return;
    }

    const declared = decodeURIComponent(String(req.header("x-file-name") ?? "")).trim();
    // The name arrives from a browser, so it is checked the same way a
    // name in a URL is: anything that would climb out of the folder is
    // refused rather than normalised into a path somewhere else.
    const safe = path.basename(declared);
    if (!safe || safe.startsWith(".") || safe !== declared) {
        res.status(400).json({ error: "That filename isn't usable inside the project's folder." });
        return;
    }
    if (!isMediaName(safe)) {
        res.status(400).json({ error: `${safe} isn't a video, audio or image file the studio reads.` });
        return;
    }

    // An upload must never quietly replace footage a cut already points
    // at, so a clashing name gets a suffix rather than the old file
    // getting overwritten.
    const target = path.join(project.folder, freeName(project.folder, safe));
    const sink = fs.createWriteStream(target);
    req.pipe(sink);

    sink.on("finish", () => {
        if (fs.statSync(target).size === 0) {
            fs.rmSync(target, { force: true });
            res.status(400).json({ error: "That upload arrived empty." });
            return;
        }
        res.json({ file: path.basename(target), files: listProjectFiles(project.folder) });
    });
    // A half-written file is worse than none: it would show up in the
    // bin and fail to decode.
    sink.on("error", (e) => {
        fs.rmSync(target, { force: true });
        res.status(500).json({ error: `Could not store that file: ${e.message}` });
    });
});

/** Takes a file out of the project's folder, for real. */
projectsRouter.delete("/:id/files/:name", (req, res) => {
    const id = parseId(req.params.id);
    const project = id === null ? null : getStudioProject(id);
    if (!project) {
        res.status(404).json({ error: "No project with that id." });
        return;
    }
    const file = resolveProjectFile(project.folder, req.params.name);
    if (!file) {
        res.status(404).json({ error: "That file isn't in this project's folder." });
        return;
    }
    fs.rmSync(file, { force: true });
    res.json({ files: listProjectFiles(project.folder) });
});

/** Re-reads the folder. Drop a file in from Finder and press refresh. */
projectsRouter.get("/:id/files", (req, res) => {
    const id = parseId(req.params.id);
    const project = id === null ? null : getStudioProject(id);
    if (!project) {
        res.status(404).json({ error: "No project with that id." });
        return;
    }
    res.json({ folder: project.folder, files: listProjectFiles(project.folder), exists: fs.existsSync(project.folder) });
});

/** What deleting this project's folder would actually take with it —
 *  everything in it, not just the media the studio recognises. */
projectsRouter.get("/:id/weight", (req, res) => {
    const id = parseId(req.params.id);
    const project = id === null ? null : getStudioProject(id);
    if (!project) {
        res.status(404).json({ error: "No project with that id." });
        return;
    }
    res.json({ folder: project.folder, ...folderWeight(project.folder) });
});

projectsRouter.delete("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const project = getStudioProject(id);

    // The folder goes only when asked, and only to the Trash. Deleting
    // the row is a database change; deleting the folder is somebody's
    // footage, and the two should never be the same keystroke by
    // accident.
    if (req.query.folder === "trash" && project?.folder) {
        try {
            await trashProjectFolder(project.folder);
        } catch (e) {
            // The row stays if the folder couldn't go: a project whose
            // files are still there but whose record is gone is the one
            // outcome nobody could recover from inside the app.
            res.status(502).json({ error: e instanceof Error ? e.message : "Could not move the folder to the Trash." });
            return;
        }
    }

    // Videos and notes survive with project_id null — see db.ts.
    deleteStudioProject(id);
    res.status(204).end();
});
