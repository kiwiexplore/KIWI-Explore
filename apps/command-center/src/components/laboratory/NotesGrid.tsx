import { Plus, StickyNote } from "lucide-react";
import type { LabNote } from "../../state/laboratoryNotes";
import "./NotesGrid.css";

interface NotesGridProps {
    notes: LabNote[];
    onSelectNote: (id: string) => void;
    onCreateNote: () => void;
}

export default function NotesGrid({ notes, onSelectNote, onCreateNote }: NotesGridProps) {
    return (
        <div className="notes-grid-page">
            <div className="notes-grid-header">
                <div>
                    <span className="notes-grid-eyebrow">Laboratory</span>
                    <h1>Notes</h1>
                </div>
                <button type="button" className="notes-grid-new" onClick={onCreateNote}>
                    <Plus size={16} strokeWidth={2} />
                    New Note
                </button>
            </div>

            {notes.length === 0 ? (
                <div className="notes-grid-empty">Nothing here yet — start your first note above.</div>
            ) : (
                <div className="notes-grid">
                    {notes.map((note) => (
                        <button key={note.id} type="button" className="note-card" onClick={() => onSelectNote(note.id)}>
                            <StickyNote size={15} strokeWidth={1.75} className="note-card-icon" />
                            <h3 className="note-card-title">{note.title}</h3>
                            <p className="note-card-preview">{note.content || "Empty note."}</p>
                            <span className="note-card-updated">{note.updatedAt}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
