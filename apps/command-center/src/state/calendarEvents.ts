/**
 * Shared calendar events — used by both Laboratory's CalendarPanel and
 * the Dashboard's Upcoming Events widget (see state/calendar.ts, lifted
 * to App.tsx same as account state), so an event added from either
 * scene shows up in both. Mock/in-memory only, same as everything else
 * in the account system.
 */
export type CalendarEventType = "meeting" | "event" | "task";

export interface CalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM, optional (all-day if omitted)
    type: CalendarEventType;
}

export const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
    meeting: "Meeting",
    event: "Event",
    task: "Task",
};

export const MOCK_EVENTS: CalendarEvent[] = [
    { id: "team-sync", title: "Team sync", date: "2026-08-10", time: "10:00", type: "meeting" },
    { id: "project-review", title: "KIWI AI OS review", date: "2026-08-12", time: "14:00", type: "meeting" },
    { id: "launch-planning", title: "Launch planning", date: "2026-08-15", type: "event" },
];

let eventCounter = 0;

export function createMockEvent(): CalendarEvent {
    eventCounter += 1;
    const today = new Date().toISOString().slice(0, 10);
    return {
        id: `event-${Date.now()}-${eventCounter}`,
        title: "New Event",
        date: today,
        type: "event",
    };
}
