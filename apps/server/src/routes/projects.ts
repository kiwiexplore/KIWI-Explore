import { Router } from "express";
import { z } from "zod";
import {
    deleteStudioProject, getStudioProject, insertStudioProject, listStudioProjects,
    listLabNotesForProject, listVideoProjectsForProject, updateStudioProject,
    listContentItemsForVideo,
} from "../db.js";
import { createProjectFolder, listProjectFiles, resolveProjectFile } from "../projectFolder.js";
import fs from "node:fs";

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
    const videos = listVideoProjectsForProject(projectId)
        .map((v) => ({ ...v, contentItems: listContentItemsForVideo(v.id) }));
    const notes = listLabNotesForProject(projectId);
    const project = getStudioProject(projectId);
    const files = project ? listProjectFiles(project.folder) : [];
    return {
        videos,
        notes,
        files,
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

projectsRouter.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    // Videos and notes survive with project_id null — see db.ts.
    deleteStudioProject(id);
    res.status(204).end();
});
