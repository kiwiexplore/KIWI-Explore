import type { ReactNode } from "react";

export type WidgetSize = "small" | "medium" | "large";

/**
 * Describes a single dashboard widget.
 *
 * Adding a new simple widget to the dashboard should mean adding one
 * entry to a WidgetDefinition[] array (see state/widgets.ts), not
 * writing a new component.
 */
export interface WidgetDefinition {
    id: string;
    title: string;
    size?: WidgetSize;
    body: ReactNode;
}
