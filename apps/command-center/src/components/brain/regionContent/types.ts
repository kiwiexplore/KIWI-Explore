import type { ComponentType } from "react";
import type { CalendarState } from "../../../state/calendar";
import type { LaboratoryDataState } from "../../../state/laboratoryData";

/**
 * Everything a region module might need to render itself. Passed down
 * whole rather than per-module props, so adding a module that reads
 * calendar events (say) doesn't mean re-threading a prop through the
 * panel, the row and the registry.
 */
export interface RegionContentContext {
    calendar: CalendarState;
    laboratoryData: LaboratoryDataState;
    /**
     * Which single story is open, by its shared key (see storyKeys), or
     * null for the module's own list.
     *
     * Owned by BrainScene3D rather than by the module that renders it,
     * because opening a story is a move of the CAMERA as much as of the
     * panel: the view turns to that story's own spot in the region. It
     * also opens from out there — clicking the pin on that spot — and a
     * thing driven from two places belongs above both of them, the same
     * argument as for the open module itself.
     */
    openStoryId: string | null;
    openStory: (storyId: string | null) => void;
}

/**
 * "summary" renders the one-line live state shown on the module's row in
 * the region overview; "detail" renders the full contents once that
 * module is opened. Same component either way — one data fetch, two
 * levels of detail (see useAsyncData for how the two mounts share it).
 */
export type ModuleViewMode = "summary" | "detail";

export interface ModuleViewProps {
    mode: ModuleViewMode;
    context: RegionContentContext;
}

export type ModuleView = ComponentType<ModuleViewProps>;
