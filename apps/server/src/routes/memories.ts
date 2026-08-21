import { Router } from "express";
import { clearMemories, listMemories } from "../db.js";

// Read/clear access to what Kiwi has learned about the user across
// sessions (see src/memory.ts for how facts get extracted) — mostly for
// transparency/debugging; nothing in the frontend surfaces this yet.
export const memoriesRouter = Router();

memoriesRouter.get("/", (_req, res) => {
    res.json({ memories: listMemories() });
});

memoriesRouter.delete("/", (_req, res) => {
    clearMemories();
    res.status(204).end();
});
