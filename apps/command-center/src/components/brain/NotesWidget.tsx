import type { MouseEvent, ReactNode } from "react";
import Panel from "../ui/Panel";
import type { LabNote } from "../../state/laboratoryNotes";
import "./NotesWidget.css";

interface NotesWidgetProps {
    notes: LabNote[];
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function NotesDetail({ notes }: { notes: LabNote[] }) {
    if (notes.length === 0) {
        return <div className="notes-widget-detail-empty">No notes yet.</div>;
    }
    return (
        <div className="notes-widget-detail">
            {notes.map((note) => (
                <div key={note.id} className="notes-widget-detail-item">
                    <div className="notes-widget-detail-title">{note.title}</div>
                    <div className="notes-widget-detail-preview">{note.content || "Empty note."}</div>
                    <div className="notes-widget-detail-meta">{note.updatedAt}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * Reads the exact same shared notes list Laboratory's global Notes
 * section edits (see state/laboratoryData.ts, owned by App.tsx) — a
 * note added in Laboratory shows up here too, same "jeden ucelenej"
 * sharing as Upcoming Events/Calendar. No external API — this is the
 * user's own data, not a public data source.
 */
export default function NotesWidget({ notes, onOpenDetail }: NotesWidgetProps) {
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("🗒️ Notes", anchor, <NotesDetail notes={notes} />, 420);
    };

    let body: ReactNode;
    if (notes.length === 0) {
        body = <span className="notes-widget-muted">No notes yet.</span>;
    } else {
        const latest = notes[0];
        body = (
            <div className="notes-widget-body">
                <div className="notes-widget-title">{latest.title}</div>
                <div className="notes-widget-meta">{notes.length} note{notes.length === 1 ? "" : "s"} · {latest.updatedAt}</div>
            </div>
        );
    }

    return <Panel title="🗒️ Notes" onClick={handleClick}>{body}</Panel>;
}
