import { useCallback, useEffect, useState } from "react";
import {
    createNote, deleteNote, fetchNotes, updateNote, type LabNote, type LabNoteKind,
} from "../lib/notesApi";

export interface LabNotesState {
    notes: LabNote[];
    loading: boolean;
    error: string | null;
    /** Only the ones of a given kind, newest first. */
    byKind: (kind: LabNoteKind) => LabNote[];
    create: (kind: LabNoteKind, title: string) => void;
    update: (id: number, changes: { title?: string; body?: string }) => void;
    remove: (id: number) => void;
}

/**
 * Ideas, trends, findings and notes — now server-backed.
 *
 * These were in-memory arrays hanging off a mock Laboratory project,
 * which meant every one of them vanished on reload. They also belonged
 * to a project, which stopped making sense once the Laboratory became a
 * video studio: a trend you're watching isn't part of one project, it's
 * a reason a video might exist.
 *
 * One hook for all four kinds, one fetch. Splitting them would mean
 * four requests for four lists that are the same shape.
 */
export function useLabNotesState(): LabNotesState {
    const [notes, setNotes] = useState<LabNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const report = useCallback((e: unknown, fallback: string) => {
        setError(e instanceof Error ? e.message : fallback);
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetchNotes()
            .then((found) => { if (!cancelled) setNotes(found); })
            .catch((e) => { if (!cancelled) report(e, "Could not load your notes."); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [report]);

    return {
        notes,
        loading,
        error,
        byKind: (kind) => notes.filter((n) => n.kind === kind),
        create: (kind, title) => {
            setError(null);
            createNote(kind, title)
                .then((note) => setNotes((prev) => [note, ...prev]))
                .catch((e) => report(e, "Could not save that."));
        },
        // Optimistic: typing into a note should feel immediate, and the
        // response replaces this with the server's own copy either way.
        update: (id, changes) => {
            setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes } : n)));
            updateNote(id, changes)
                .then((note) => setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n))))
                .catch((e) => report(e, "Could not save that."));
        },
        remove: (id) => {
            setNotes((prev) => prev.filter((n) => n.id !== id));
            deleteNote(id).catch(() => { /* local state already reflects it */ });
        },
    };
}
