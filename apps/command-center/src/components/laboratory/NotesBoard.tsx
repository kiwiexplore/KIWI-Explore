import { useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import type { LabNotesState } from "../../state/labNotes";
import type { LabNote, LabNoteKind } from "../../lib/notesApi";
import "./GlobalBoard.css";
import "./NotesBoard.css";

interface KindCopy {
    heading: string;
    placeholder: string;
    empty: string;
    /** What this list is FOR, in one line, under the heading. */
    blurb: string;
}

/**
 * The four lists differ only in what they're for, so that's all that
 * varies here. Writing four components would have meant four places to
 * fix the same bug.
 */
const COPY: Record<LabNoteKind, KindCopy> = {
    idea: {
        heading: "Ideas",
        blurb: "Videos you might make. Rough is fine — the point is not losing them.",
        placeholder: "A video you could make…",
        empty: "No ideas yet. Write the next one down before it goes.",
    },
    trend: {
        heading: "Trends",
        blurb: "Topics worth watching, so you know what's worth making before you make it.",
        placeholder: "A topic to keep an eye on…",
        empty: "Nothing tracked yet. Add a topic you keep seeing.",
    },
    research: {
        heading: "Research",
        blurb: "What you found out — sources, numbers, things worth saying on camera.",
        placeholder: "Something you found out…",
        empty: "Nothing here yet. Save what you learn so a script can use it.",
    },
    note: {
        heading: "Notes",
        blurb: "Everything else worth keeping.",
        placeholder: "A note…",
        empty: "Nothing yet.",
    },
};

function NoteRow({ note, notes }: { note: LabNote; notes: LabNotesState }) {
    const [open, setOpen] = useState(false);
    const [titleDraft, setTitleDraft] = useState(note.title);

    // Committed on blur rather than per keystroke — the alternative is a
    // PATCH for every character typed.
    const commitTitle = () => {
        const next = titleDraft.trim();
        if (!next || next === note.title) {
            setTitleDraft(note.title);
            return;
        }
        notes.update(note.id, { title: next });
    };

    return (
        <div className="notes-board-item">
            <div className="notes-board-item-head">
                <button
                    type="button"
                    className={`notes-board-toggle${open ? " notes-board-toggle-open" : ""}`}
                    onClick={() => setOpen((o) => !o)}
                    aria-label={open ? "Collapse" : "Expand"}
                >
                    <ChevronDown size={14} strokeWidth={2} />
                </button>
                <input
                    className="notes-board-title"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    aria-label="Title"
                />
                <button
                    type="button"
                    className="notes-board-remove"
                    onClick={() => notes.remove(note.id)}
                    aria-label="Delete"
                >
                    <Trash2 size={14} strokeWidth={1.75} />
                </button>
            </div>

            {open && (
                <textarea
                    className="notes-board-body"
                    value={note.body}
                    onChange={(e) => notes.update(note.id, { body: e.target.value })}
                    placeholder="Anything worth keeping about this…"
                    rows={5}
                />
            )}
        </div>
    );
}

/**
 * Ideas, Trends, Research and Notes — one board, four uses.
 *
 * These four sections used to be separate components writing into
 * in-memory arrays on a mock project, so everything typed into them was
 * gone on reload and none of it could ever be pointed at by a video.
 * They now share this one board and live in apps/server's lab_notes
 * table, which is what lets a video record the idea it came from.
 */
export default function NotesBoard({ kind, notes }: { kind: LabNoteKind; notes: LabNotesState }) {
    const [draft, setDraft] = useState("");
    const copy = COPY[kind];
    const items = notes.byKind(kind);

    const handleAdd = (event: FormEvent) => {
        event.preventDefault();
        if (!draft.trim()) return;
        notes.create(kind, draft.trim());
        setDraft("");
    };

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>{copy.heading}</h1>
                </div>
                {items.length > 0 && <span className="global-board-summary">{items.length} saved</span>}
            </div>

            <p className="notes-board-blurb">{copy.blurb}</p>

            {notes.error && (
                <div className="notes-board-error">
                    <AlertTriangle size={14} strokeWidth={2} />
                    <span>{notes.error}</span>
                </div>
            )}

            <form className="notes-board-add" onSubmit={handleAdd}>
                <input
                    className="notes-board-add-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={copy.placeholder}
                />
                <button type="submit" className="notes-board-add-btn" disabled={!draft.trim()}>Save</button>
            </form>

            {notes.loading ? (
                <p className="notes-board-blurb">Loading…</p>
            ) : items.length === 0 ? (
                <div className="global-board-empty">{copy.empty}</div>
            ) : (
                <div className="notes-board-list">
                    {items.map((note) => <NoteRow key={note.id} note={note} notes={notes} />)}
                </div>
            )}
        </div>
    );
}
