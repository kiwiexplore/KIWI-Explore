import type { WidgetDefinition } from "../../types/widget";

/**
 * Placeholder widgets for the 3D Brain test harness — like
 * state/widgets.ts (same WidgetDefinition shape, same Widget/Panel
 * renderer) but local to this scene rather than the real KIWI HQ
 * dashboard, since this file is still the isolated 3D preview.
 * `body` is placeholder text — real data sources come later.
 *
 * Split three ways: 3 "main" widgets pinned in each of the left/right
 * columns beside the brain (Weather/Date on the left, YouTube on the
 * right, per explicit request — bigger than the bottom row's, since
 * these are the primary ones), and the rest in the
 * horizontally-scrollable row below the brain.
 */
export const leftWidgets: WidgetDefinition[] = [
    { id: "weather", title: "🌤️ Weather", body: "No data available." },
    { id: "date", title: "📆 Date", body: new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) },
    { id: "ai-agents", title: "🤖 AI Agents", body: "No active agents." },
];

export const rightWidgets: WidgetDefinition[] = [
    { id: "youtube", title: "▶️ YouTube", body: "No data available." },
    { id: "projects", title: "📁 Projects", body: "No active projects." },
    { id: "connected-apps", title: "🔗 Connected Apps", body: "No apps connected." },
];

// 20 on purpose (per explicit request) — this is likely close to the
// real max widget count, so it's the size that actually needs to be
// tested against the horizontal scrollbar, not a small illustrative set.
export const bottomWidgets: WidgetDefinition[] = [
    { id: "top-news", title: "📰 Top News", body: "No data available." },
    { id: "upcoming-events", title: "📅 Upcoming Events", body: "No events scheduled." },
    { id: "space-news", title: "🌌 Space News", body: "No data available." },
    { id: "space-missions", title: "🚀 Space Missions", body: "No data available." },
    { id: "entertainment", title: "🎮 Entertainment", body: "No data available." },
    { id: "budget", title: "💰 Budget", body: "No data available." },
    { id: "fitness", title: "🏋️ Fitness", body: "No data available." },
    { id: "sleep", title: "😴 Sleep", body: "No data available." },
    { id: "notes", title: "🗒️ Notes", body: "No data available." },
    { id: "reminders", title: "⏰ Reminders", body: "No data available." },
    { id: "podcasts", title: "🎙️ Podcasts", body: "No data available." },
    { id: "music", title: "🎵 Music", body: "No data available." },
    { id: "recipes", title: "🍳 Recipes", body: "No data available." },
    { id: "shopping", title: "🛒 Shopping List", body: "No data available." },
    { id: "traffic", title: "🚗 Traffic", body: "No data available." },
    { id: "stocks", title: "📊 Stocks", body: "No data available." },
    { id: "crypto", title: "🪙 Crypto", body: "No data available." },
    { id: "smart-home", title: "🏠 Smart Home", body: "No data available." },
    { id: "photos", title: "🖼️ Photos", body: "No data available." },
    { id: "goals", title: "🎯 Goals", body: "No data available." },
    { id: "team", title: "🧑‍🤝‍🧑 Team", body: "No data available." },
    { id: "support", title: "🛟 Support Tickets", body: "No data available." },
];
