/**
 * Which region modules have real contents behind them today.
 *
 * Kept apart from ModuleContent itself (which renders them) only because
 * a file that mixes component and non-component exports breaks Vite's
 * fast refresh — see the lint rule react-refresh/only-export-components.
 * The two must stay in step: a module added to ModuleContent's switch
 * belongs in this set as well, or the panel will keep showing its
 * "not connected yet" state.
 */
const MODULES_WITH_CONTENT = new Set([
    "weather", "news", "space", "entertainment", "finance", "adventure", "meals",
    "calendar", "projects", "documents", "research", "social", "systems",
    "learning", "health", "communication",
]);

export function hasModuleContent(moduleId: string): boolean {
    return MODULES_WITH_CONTENT.has(moduleId);
}
