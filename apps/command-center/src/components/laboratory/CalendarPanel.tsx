import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { EVENT_TYPE_LABEL, type CalendarEvent, type CalendarEventType } from "../../state/calendarEvents";
import "./CalendarPanel.css";

interface CalendarPanelProps {
    onClose: () => void;
    events: CalendarEvent[];
    onAddEvent: (event: Omit<CalendarEvent, "id">) => void;
    onRemoveEvent: (id: string) => void;
}

function formatDate(dateStr: string): string {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Laboratory's calendar — a right-side sheet, same pattern as
 * KiwiPanel. Reads/writes the exact same event list the Dashboard's
 * Upcoming Events widget shows (see state/calendar.ts, owned by
 * App.tsx) — adding an event here shows up there too, "jeden ucelenej
 * kalendar" per explicit request, not two separate copies.
 */
export default function CalendarPanel({ onClose, events, onAddEvent, onRemoveEvent }: CalendarPanelProps) {
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [time, setTime] = useState("");
    const [type, setType] = useState<CalendarEventType>("event");

    const handleAdd = () => {
        if (!title.trim()) return;
        onAddEvent({ title: title.trim(), date, time: time || undefined, type });
        setTitle("");
        setTime("");
        setType("event");
        setAdding(false);
    };

    return (
        <>
            <div className="cal-panel-scrim" onClick={onClose} />
            <aside className="cal-panel">
                <header className="cal-panel-header">
                    <span className="cal-panel-title">Calendar</span>
                    <button type="button" className="cal-panel-close" onClick={onClose} aria-label="Close">
                        <X size={16} strokeWidth={1.75} />
                    </button>
                </header>

                <div className="cal-panel-body">
                    {events.length === 0 ? (
                        <p className="cal-panel-empty">No events scheduled yet.</p>
                    ) : (
                        <div className="cal-panel-list">
                            {events.map((event) => (
                                <div key={event.id} className="cal-panel-event">
                                    <div className="cal-panel-event-date">{formatDate(event.date)}</div>
                                    <div className="cal-panel-event-main">
                                        <span className="cal-panel-event-title">{event.title}</span>
                                        <span className="cal-panel-event-meta">
                                            {EVENT_TYPE_LABEL[event.type]}{event.time ? ` · ${event.time}` : ""}
                                        </span>
                                    </div>
                                    <button type="button" className="cal-panel-event-remove" onClick={() => onRemoveEvent(event.id)} aria-label="Remove event">
                                        <Trash2 size={13} strokeWidth={1.75} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {adding ? (
                    <div className="cal-panel-form">
                        <input
                            type="text"
                            className="cal-panel-input"
                            placeholder="Event title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                        <div className="cal-panel-form-row">
                            <input type="date" className="cal-panel-input" value={date} onChange={(e) => setDate(e.target.value)} />
                            <input type="time" className="cal-panel-input" value={time} onChange={(e) => setTime(e.target.value)} />
                        </div>
                        <select className="cal-panel-input" value={type} onChange={(e) => setType(e.target.value as CalendarEventType)}>
                            {(Object.keys(EVENT_TYPE_LABEL) as CalendarEventType[]).map((t) => (
                                <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>
                            ))}
                        </select>
                        <div className="cal-panel-form-actions">
                            <button type="button" className="cal-panel-form-cancel" onClick={() => setAdding(false)}>Cancel</button>
                            <button type="button" className="cal-panel-form-save" onClick={handleAdd} disabled={!title.trim()}>Add</button>
                        </div>
                    </div>
                ) : (
                    <button type="button" className="cal-panel-add" onClick={() => setAdding(true)}>
                        <Plus size={15} strokeWidth={2} />
                        New Event
                    </button>
                )}
            </aside>
        </>
    );
}
