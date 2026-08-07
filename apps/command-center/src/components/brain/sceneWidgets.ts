import type { WidgetDefinition } from "../../types/widget";

/**
 * The KIWI HQ dashboard's widget registry — `body` is placeholder text
 * for the ones not yet wired to a real source (see WeatherWidget/
 * SpaceNewsWidget/SpaceMissionsWidget/RecipesWidget for the ones that
 * are — those override the generic Widget renderer entirely, so their
 * placeholder `body` here is only ever a fallback).
 *
 * Split two ways now: 10 in the left column, 10 in the right — no more
 * separate bottom row (per explicit request, it felt too cluttered
 * piled on top of the columns). Both columns scroll vertically (see
 * .side-widget-column) to fit all 10 at their normal size.
 */
export const leftWidgets: WidgetDefinition[] = [
    { id: "weather", title: "🌤️ Weather", body: "No data available." },
    { id: "date", title: "📆 Date", body: new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) },
    { id: "ai-agents", title: "🤖 AI Agents", body: "No active agents." },
    { id: "top-news", title: "📰 Top News", body: "No data available." },
    { id: "upcoming-events", title: "📅 Upcoming Events", body: "No events scheduled." },
    { id: "space-news", title: "🌌 Space News", body: "No data available." },
    { id: "space-missions", title: "🚀 Space Missions", body: "No data available." },
    { id: "entertainment", title: "🎮 Entertainment", body: "No data available." },
    { id: "budget", title: "💰 Budget", body: "No data available." },
    { id: "fitness", title: "🏋️ Fitness", body: "No data available." },
];

export const rightWidgets: WidgetDefinition[] = [
    { id: "youtube", title: "▶️ YouTube", body: "No data available." },
    { id: "projects", title: "📁 Projects", body: "No active projects." },
    { id: "connected-apps", title: "🔗 Connected Apps", body: "No apps connected." },
    { id: "sleep", title: "😴 Sleep", body: "No data available." },
    { id: "notes", title: "🗒️ Notes", body: "No data available." },
    { id: "reminders", title: "⏰ Reminders", body: "No data available." },
    { id: "podcasts", title: "🎙️ Podcasts", body: "No data available." },
    { id: "music", title: "🎵 Music", body: "No data available." },
    { id: "recipes", title: "🍳 Recipes", body: "No data available." },
    { id: "shopping", title: "🛒 Shopping List", body: "No data available." },
];
