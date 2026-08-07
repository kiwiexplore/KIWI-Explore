import type { ReactNode } from "react";

export type WidgetSize = "small" | "medium" | "large";
export type WidgetColumn = "left" | "right";

/**
 * Describes a single dashboard widget.
 *
 * Adding a new simple widget to the dashboard should mean adding one
 * entry to a WidgetDefinition[] array (see brain/sceneWidgets.ts), not
 * writing a new component.
 *
 * `column` controls which side panel the widget renders in on the
 * KIWI HQ 3-column layout. Defaults to "left" when omitted.
 */
export interface WidgetDefinition {
    id: string;
    title: string;
    size?: WidgetSize;
    column?: WidgetColumn;
    body: ReactNode;
}