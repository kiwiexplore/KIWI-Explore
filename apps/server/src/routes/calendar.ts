import { Router } from "express";
import { getValidGoogleAccessToken, GoogleNotConnectedError, GoogleNotConfiguredError } from "../google.js";

export const calendarRouter = Router();

export interface GoogleCalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM, omitted for all-day events
    // Google's own event page — lets the frontend open the real event
    // instead of just displaying it read-only (see UpcomingEventsWidget).
    link: string;
}

interface RawGoogleEvent {
    id: string;
    summary?: string;
    start?: { date?: string; dateTime?: string };
    htmlLink?: string;
}

function toCalendarEvent(raw: RawGoogleEvent): GoogleCalendarEvent | null {
    if (!raw.start) return null;
    const link = raw.htmlLink ?? "";
    if (raw.start.date) return { id: raw.id, title: raw.summary || "(untitled)", date: raw.start.date, link };
    if (raw.start.dateTime) {
        // Sliced directly out of Google's own "2026-08-15T10:00:00-07:00"
        // rather than going through a Date object, so the event's own
        // timezone is preserved as-is instead of being reinterpreted in
        // whatever timezone this server happens to run in.
        return { id: raw.id, title: raw.summary || "(untitled)", date: raw.start.dateTime.slice(0, 10), time: raw.start.dateTime.slice(11, 16), link };
    }
    return null;
}

calendarRouter.get("/events", async (_req, res) => {
    try {
        const accessToken = await getValidGoogleAccessToken();
        const params = new URLSearchParams({
            timeMin: new Date().toISOString(),
            maxResults: "10",
            singleEvents: "true",
            orderBy: "startTime",
        });
        const apiRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!apiRes.ok) {
            const body = await apiRes.text().catch(() => "");
            throw new Error(`Google Calendar API request failed: ${apiRes.status} ${body}`.trim());
        }
        const data = (await apiRes.json()) as { items?: RawGoogleEvent[] };
        const events = (data.items ?? [])
            .map(toCalendarEvent)
            .filter((e): e is GoogleCalendarEvent => e !== null);
        res.json({ events });
    } catch (e) {
        if (e instanceof GoogleNotConnectedError) {
            res.status(404).json({ error: e.message });
            return;
        }
        if (e instanceof GoogleNotConfiguredError) {
            res.status(503).json({ error: e.message });
            return;
        }
        console.error("Fetching Google Calendar events failed:", e);
        res.status(502).json({ error: e instanceof Error ? e.message : "Could not reach Google Calendar." });
    }
});
