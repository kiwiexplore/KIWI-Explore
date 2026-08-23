import { Router } from "express";
import { z } from "zod";
import {
    deleteLabNote, getLabNote, insertLabNote, listLabNotes, updateLabNote,
    LAB_NOTE_KINDS, type LabNoteKind,
} from "../db.js";

/**
 * Ideas, tracked trends, findings and loose notes — the four lists that
 * feed a video before it exists.
 *
 * One route rather than four, matching the one table: they are the same
 * shape, and the only thing that differs is which list a thing belongs
 * to. Splitting them would mean four of everything to say the same
 * thing.
 */
export const notesRouter = Router();

const kindSchema = z.enum(LAB_NOTE_KINDS as [string, ...string[]]);

notesRouter.get("/", (req, res) => {
    const kind = req.query.kind;
    if (kind !== undefined) {
        const parsed = kindSchema.safeParse(kind);
        if (!parsed.success) {
            res.status(400).json({ error: `kind must be one of: ${LAB_NOTE_KINDS.join(", ")}.` });
            return;
        }
        res.json({ notes: listLabNotes(parsed.data as LabNoteKind) });
        return;
    }
    res.json({ notes: listLabNotes() });
});

const createSchema = z.object({
    kind: kindSchema,
    title: z.string().trim().min(1).max(300),
    body: z.string().max(20000).optional(),
    projectId: z.number().int().nullable().optional(),
});

notesRouter.post("/", (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "kind and a title are required." });
        return;
    }
    const { kind, title, body, projectId } = parsed.data;
    res.json({ note: insertLabNote(kind as LabNoteKind, title, body ?? "", projectId ?? null) });
});

const updateSchema = z.object({
    title: z.string().trim().min(1).max(300).optional(),
    body: z.string().max(20000).optional(),
    projectId: z.number().int().nullable().optional(),
    videoProjectId: z.number().int().nullable().optional(),
    done: z.boolean().optional(),
});

notesRouter.patch("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid title or body." });
        return;
    }
    if (!getLabNote(id)) {
        res.status(404).json({ error: "No note with that id." });
        return;
    }
    res.json({ note: updateLabNote(id, parsed.data) });
});

notesRouter.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid id." });
        return;
    }
    // A video that came from this note keeps existing, with its
    // source_note_id set to null (ON DELETE SET NULL) — deleting the
    // idea shouldn't take the video with it.
    deleteLabNote(id);
    res.status(204).end();
});
