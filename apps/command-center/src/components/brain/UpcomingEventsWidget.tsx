import type { MouseEvent, ReactNode } from "react";
import Panel from "../ui/Panel";
import { EVENT_TYPE_LABEL, type CalendarEvent } from "../../state/calendarEvents";
import "./UpcomingEventsWidget.css";

interface UpcomingEventsWidgetProps {
    events: CalendarEvent[];
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function formatDate(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function upcomingOnly(events: CalendarEvent[]): CalendarEvent[] {
    const today = new Date().toISOString().slice(0, 10);
    return events.filter((e) => e.date >= today);
}

function UpcomingEventsDetail({ events }: { events: CalendarEvent[] }) {
    if (events.length === 0) {
        return <div className="upcoming-events-detail-empty">No events scheduled.</div>;
    }
    return (
        <div className="upcoming-events-detail">
            {events.map((event) => (
                <div key={event.id} className="upcoming-events-detail-item">
                    <div className="upcoming-events-detail-date">{formatDate(event.date)}</div>
                    <div className="upcoming-events-detail-text">
                        <div className="upcoming-events-detail-title">{event.title}</div>
                        <div className="upcoming-events-detail-meta">
                            {EVENT_TYPE_LABEL[event.type]}{event.time ? ` · ${event.time}` : ""}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Reads the exact same shared event list as Laboratory's CalendarPanel
 * (see state/calendar.ts, owned by App.tsx) — an event added from
 * either scene shows up in both, per explicit request ("jeden ucelenej
 * kalendar"). Compact view shows just the next upcoming event; the
 * detail drawer lists everything upcoming.
 */
export default function UpcomingEventsWidget({ events, onOpenDetail }: UpcomingEventsWidgetProps) {
    const upcoming = upcomingOnly(events);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("📅 Upcoming Events", anchor, <UpcomingEventsDetail events={upcoming} />, 420);
    };

    let body: ReactNode;
    if (upcoming.length === 0) {
        body = <span className="upcoming-events-widget-muted">No events scheduled.</span>;
    } else {
        const next = upcoming[0];
        body = (
            <div className="upcoming-events-widget-body">
                <div className="upcoming-events-widget-title">{next.title}</div>
                <div className="upcoming-events-widget-meta">
                    {formatDate(next.date)}{next.time ? ` · ${next.time}` : ""}
                </div>
            </div>
        );
    }

    return <Panel title="📅 Upcoming Events" onClick={handleClick}>{body}</Panel>;
}
