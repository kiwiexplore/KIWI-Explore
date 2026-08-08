import { ArrowLeft } from "lucide-react";
import type { LabNote } from "../../state/laboratoryNotes";
import "./NoteEditor.css";

interface NoteEditorProps {
    note: LabNote;
    onBack: () => void;
    onChange: (id: string, changes: Partial<Pick<LabNote, "title" | "content">>) => void;
}

/**
 * Editing a note just updates it in place in Laboratory's own state as
 * you type (no explicit save step) — same "no backend, just local
 * state" mock philosophy as the rest of the account system.
 */
export default function NoteEditor({ note, onBack, onChange }: NoteEditorProps) {
    return (
        <div className="note-editor">
            <button type="button" className="note-editor-back" onClick={onBack}>
                <ArrowLeft size={14} strokeWidth={2} />
                Notes
            </button>

            <input
                type="text"
                className="note-editor-title"
                value={note.title}
                onChange={(e) => onChange(note.id, { title: e.target.value })}
                placeholder="Untitled note"
            />

            <textarea
                className="note-editor-content"
                value={note.content}
                onChange={(e) => onChange(note.id, { content: e.target.value })}
                placeholder="Start writing..."
            />
        </div>
    );
}
