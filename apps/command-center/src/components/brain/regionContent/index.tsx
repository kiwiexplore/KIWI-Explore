import type { ReactNode } from "react";
import {
    WeatherModule, NewsModule, SpaceModule, EntertainmentModule,
    FinanceModule, AdventureModule, MealsModule,
} from "./LiveModules";
import { CalendarModule, ProjectsModule, DocumentsModule, ResearchModule } from "./WorkspaceModules";
import { SocialModule } from "./SocialModule";
import { SystemsModule } from "./SystemsModule";
import { HealthModule, LearningModule } from "./PersonalModules";
import { CommunicationModule } from "./MailModule";
import type { ModuleViewMode, RegionContentContext } from "./types";

export type { ModuleViewProps, ModuleViewMode, RegionContentContext } from "./types";

interface ModuleContentProps {
    /** Module id from state/brainRegions.ts. */
    moduleId: string;
    mode: ModuleViewMode;
    context: RegionContentContext;
}

/**
 * Renders a region module's contents — the one-line live state for its
 * row in the region overview ("summary"), or the full thing once it's
 * opened ("detail"). See BrainRegionPanel for those two levels.
 *
 * Whether a module has contents at all is answered by hasModuleContent
 * in moduleCatalog.ts — same list, kept in a separate file for fast
 * refresh's sake (see its own comment).
 *
 * A module missing from this switch has no data behind it yet (Travel,
 * which needs a paid API): the
 * panel says so plainly rather than inventing a number. That's why this
 * is a switch with holes in it instead of a field on every module — the
 * honest empty state is the default, and a module joins the list the day
 * it has something real to show.
 *
 * "laboratory" is deliberately absent too, but for the opposite reason:
 * it isn't content at all, it switches scenes (see BrainRegionPanel).
 *
 * Written as a switch over statically-imported components rather than a
 * `Record<string, ComponentType>` looked up during render: a component
 * pulled out of a map and rendered as <View/> is a newly created
 * component type on every render as far as React is concerned, which
 * resets its state (and its in-flight fetch) each time the panel
 * re-renders.
 */
export function ModuleContent({ moduleId, mode, context }: ModuleContentProps): ReactNode {
    switch (moduleId) {
        case "weather": return <WeatherModule mode={mode} context={context} />;
        case "news": return <NewsModule mode={mode} context={context} />;
        case "space": return <SpaceModule mode={mode} context={context} />;
        case "entertainment": return <EntertainmentModule mode={mode} context={context} />;
        case "finance": return <FinanceModule mode={mode} context={context} />;
        case "adventure": return <AdventureModule mode={mode} context={context} />;
        case "meals": return <MealsModule mode={mode} context={context} />;
        case "calendar": return <CalendarModule mode={mode} context={context} />;
        case "projects": return <ProjectsModule mode={mode} context={context} />;
        case "documents": return <DocumentsModule mode={mode} context={context} />;
        case "research": return <ResearchModule mode={mode} context={context} />;
        case "social": return <SocialModule mode={mode} context={context} />;
        case "systems": return <SystemsModule mode={mode} context={context} />;
        case "learning": return <LearningModule mode={mode} context={context} />;
        case "health": return <HealthModule mode={mode} context={context} />;
        case "communication": return <CommunicationModule mode={mode} context={context} />;
        default: return null;
    }
}
