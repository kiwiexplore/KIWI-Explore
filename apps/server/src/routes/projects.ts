import { Router } from "express";
import { z } from "zod";
import {
    deleteStudioProject, getStudioProject, insertStudioProject, listStudioProjects,
    listLabNotesForProject, listVideoProjectsForProject, updateStudioProject,
} from "../db.js";

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
    const videos = listVideoProjectsForProject(projectId);
    const notes = listLabNotesForProject(projectId);
    return {
        videos,
        notes,
        counts: {
            videos: videos.length,
            published: videos.filter((v) => v.stage === "published").length,
            failed: videos.filter((v) => v.transcript_status === "failed").length,
            ideas: notes.length,
            ideasDone: notes.filter((n) => n.done === 1).length,
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
    const created = insertStudioProject(parsed.data.title, parsed.data.description ?? "");
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
