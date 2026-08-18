import type { ModuleViewProps } from "./types";
import { EVENT_TYPE_LABEL, type CalendarEvent } from "../../../state/calendarEvents";

/**
 * Region modules backed by the app's OWN state rather than an outside
 * API — the same projects, notes and calendar events Laboratory edits
 * (all owned by App.tsx, see its doc comment). Nothing is fetched here;
 * these read live from state, so an event added in Laboratory shows up
 * on the brain immediately.
 */

function formatEventDay(event: CalendarEvent): string {
    const date = new Date(`${event.date}T${event.time ?? "00:00"}`);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return event.time ? `Today ${event.time}` : "Today";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + (event.time ? ` ${event.time}` : "");
}

function upcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
    // The list is already sorted by date (see state/calendar.ts); this
    // just drops what's already past, so "next up" is genuinely next.
    const today = new Date().toISOString().slice(0, 10);
    return events.filter((event) => event.date >= today);
}

export function CalendarModule({ mode, context }: ModuleViewProps) {
    const events = upcomingEvents(context.calendar.events);

    if (events.length === 0) return <span className="module-muted">{mode === "summary" ? "nothing scheduled" : "Nothing scheduled. Events added in Laboratory show up here."}</span>;
    if (mode === "summary") return <>{formatEventDay(events[0])} · {events[0].title}</>;

    return (
        <ul className="module-list module-detail">
            {events.map((event) => (
                <li key={event.id} className="module-row">
                    <span className="module-row-lead">{formatEventDay(event)}</span>
                    <span>{event.title}</span>
                    <span className="module-row-trail">{EVENT_TYPE_LABEL[event.type]}</span>
                </li>
            ))}
        </ul>
    );
}

export function ProjectsModule({ mode, context }: ModuleViewProps) {
    const projects = context.laboratoryData.projects;
    const active = projects.filter((project) => project.status === "active");

    if (projects.length === 0) return <span className="module-muted">{mode === "summary" ? "none yet" : "No projects yet — start one in Laboratory."}</span>;

    if (mode === "summary") {
        const lead = active[0] ?? projects[0];
        return <>{active.length} active · {lead.name} {lead.progress}%</>;
    }

    return (
        <ul className="module-list module-detail">
            {projects.map((project) => (
                <li key={project.id} className="module-progress-row">
                    <span className="module-progress-head">
                        <span>{project.name}</span>
                        <span className="module-row-trail">{project.progress}%</span>
                    </span>
                    <span className="module-progress-track">
                        <span className="module-progress-fill" style={{ width: `${project.progress}%` }} />
                    </span>
                    <span className="module-link-meta">{project.category} · {project.lastActivity}</span>
                </li>
            ))}
        </ul>
    );
}

export function DocumentsModule({ mode, context }: ModuleViewProps) {
    const notes = context.laboratoryData.notes;

    if (notes.length === 0) return <span className="module-muted">{mode === "summary" ? "empty" : "No notes yet — write one in Laboratory."}</span>;
    if (mode === "summary") return <>{notes.length} notes · latest: {notes[0].title}</>;

    return (
        <ul className="module-list module-detail">
            {notes.map((note) => (
                <li key={note.id} className="module-note">
                    <span className="module-link-title">{note.title}</span>
                    <span className="module-note-excerpt">{note.content.slice(0, 140)}</span>
                    <span className="module-link-meta">{note.updatedAt}</span>
                </li>
            ))}
        </ul>
    );
}

export function ResearchModule({ mode, context }: ModuleViewProps) {
    const entries = context.laboratoryData.researchEntries;

    if (entries.length === 0) return <span className="module-muted">{mode === "summary" ? "empty" : "No findings yet — add one in Laboratory."}</span>;
    if (mode === "summary") return <>{entries.length} findings · latest: {entries[0].title}</>;

    return (
        <ul className="module-list module-detail">
            {entries.map((entry) => (
                <li key={entry.id} className="module-note">
                    <span className="module-link-title">{entry.title}</span>
                    <span className="module-note-excerpt">{entry.summary}</span>
                    <span className="module-link-meta">{entry.tag} · {entry.savedAt}</span>
                </li>
            ))}
        </ul>
    );
}
