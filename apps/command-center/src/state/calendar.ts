import { useState } from "react";
import { MOCK_EVENTS, type CalendarEvent } from "./calendarEvents";

export interface CalendarState {
    events: CalendarEvent[];
    addEvent: (event: Omit<CalendarEvent, "id">) => void;
    removeEvent: (id: string) => void;
}

function sortByDate(events: CalendarEvent[]): CalendarEvent[] {
    return [...events].sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}

/**
 * Owned by App.tsx (see useAccountState for the identical pattern) so
 * the exact same event list is shared between Laboratory's CalendarPanel
 * and the Dashboard's Upcoming Events widget — "jeden ucelenej
 * kalendar" per explicit request, not two separate copies.
 */
export function useCalendarState(): CalendarState {
    const [events, setEvents] = useState<CalendarEvent[]>(() => sortByDate(MOCK_EVENTS));

    const addEvent = (event: Omit<CalendarEvent, "id">) => {
        setEvents((prev) => sortByDate([...prev, { ...event, id: `event-${Date.now()}` }]));
    };

    const removeEvent = (id: string) => {
        setEvents((prev) => prev.filter((e) => e.id !== id));
    };

    return { events, addEvent, removeEvent };
}
