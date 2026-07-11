import type { WidgetDefinition } from "../types/widget";

/**
 * Default widget registry shown on the KIWI HQ dashboard.
 *
 * To add a new simple widget: add an entry here. No new component needed
 * unless the widget requires custom interactive behavior (like CommandBar).
 *
 * `body` is a placeholder for now — real data sources (weather, news,
 * finance...) will be wired in during Phase 2 (Intelligence / Integrations).
 */
export const defaultWidgets: WidgetDefinition[] = [
    {
        id: "space-news",
        title: "🚀 Space News",
        body: "No data available.",
    },
    {
        id: "ai-news",
        title: "🤖 AI News",
        body: "No data available.",
    },
    {
        id: "projects",
        title: "📁 Projects",
        body: "No active projects.",
    },
];
