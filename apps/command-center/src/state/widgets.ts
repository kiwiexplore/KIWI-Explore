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
        column: "left",
        body: "No data available.",
    },
    {
        id: "ai-news",
        title: "🤖 AI News",
        column: "left",
        body: "No data available.",
    },
    {
        id: "projects",
        title: "📁 Projects",
        column: "right",
        body: "No active projects.",
    },
];
