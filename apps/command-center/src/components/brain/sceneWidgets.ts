import type { WidgetDefinition } from "../../types/widget";

/**
 * Placeholder widgets for the 3D Brain test harness — like
 * state/widgets.ts (same WidgetDefinition shape, same Widget/Panel
 * renderer) but local to this scene rather than the real KIWI HQ
 * dashboard, since this file is still the isolated 3D preview.
 * `body` is placeholder text — real data sources come later.
 */
// All widgets now live in the left/right columns (no below-the-fold
// row) — split evenly between the two sides.
export const leftWidgets: WidgetDefinition[] = [
    { id: "space-news", title: "🌌 Space News", body: "No data available." },
    { id: "ai-agents", title: "🤖 AI Agents", body: "No active agents." },
    { id: "weather", title: "🌤️ Weather", body: "No data available." },
    { id: "top-news", title: "📰 Top News", body: "No data available." },
];

export const rightWidgets: WidgetDefinition[] = [
    { id: "projects", title: "📁 Projects", body: "No active projects." },
    { id: "connected-apps", title: "🔗 Connected Apps", body: "No apps connected." },
    { id: "upcoming-events", title: "📅 Upcoming Events", body: "No events scheduled." },
    { id: "space-missions", title: "🚀 Space Missions", body: "No data available." },
];
