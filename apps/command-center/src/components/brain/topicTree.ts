import { regionSites } from "./regionSites";
import { regionPins } from "./regionPins";
import type { RegionFact } from "./regionContent/regionFacts";
import type { BrainRegionDefinition } from "../../state/brainRegions";

// The region's own node sits a little further off the surface than its
// categories, so the three levels read as three depths rather than as
// one crowded shell.
const REGION_LIFT = 1.13;

export type TopicLevel = "region" | "category" | "story";

/**
 * One thing the brain is currently holding: an area, a topic inside it,
 * or a single story inside that.
 */
export interface TopicNode {
    /** Unique within a region — a module id, or a story's own key. */
    id: string;
    level: TopicLevel;
    label: string;
    position: [number, number, number];
    /** Where this hangs from, for the tether drawn between them. */
    parent: [number, number, number] | null;
    /** The category this belongs to. Null on the region node itself. */
    moduleId: string | null;
    /** Set on stories that can be opened — see storyKeys. */
    storyId?: string;
    /** The fact behind a story node, for opening it. */
    fact?: RegionFact;
}

/**
 * Everything the open region contains, as a tree of particles.
 *
 * One particle per thing (per explicit request): the area itself, each
 * of its topics, and every story under those topics — so the count in
 * the brain is the count of what's actually there, and it changes as
 * stories come and go rather than being a fixed decoration.
 *
 * Every particle keeps its place whichever level you're looking at.
 * What changes with the level is only which ones are NAMED: all of them
 * at once was the whole problem — thirty labels over one wall, none of
 * them readable (see RegionDataPins).
 *
 * Positions come from the same two functions everything else uses —
 * regionSites for topics, regionPins for stories — because the camera
 * turns to these exact points when something is opened, and a particle
 * that isn't where the camera goes is worse than no particle.
 */
export function topicTree(region: BrainRegionDefinition | null, facts: RegionFact[]): TopicNode[] {
    if (!region) return [];

    const anchor: [number, number, number] = [
        region.anchor[0] * REGION_LIFT,
        region.anchor[1] * REGION_LIFT,
        region.anchor[2] * REGION_LIFT,
    ];

    const nodes: TopicNode[] = [{
        id: region.id,
        level: "region",
        label: `${region.icon} ${region.domain}`,
        position: anchor,
        parent: null,
        moduleId: null,
    }];

    const sites = regionSites(region);
    region.modules.forEach((module) => {
        const site = sites.get(module.id);
        if (!site) return;
        nodes.push({
            id: module.id,
            level: "category",
            label: `${module.icon} ${module.label}`,
            position: site,
            parent: anchor,
            moduleId: module.id,
        });
    });

    regionPins(region, facts).forEach((pin) => {
        const site = sites.get(pin.fact.moduleId);
        nodes.push({
            // A fact with no story of its own (a project's progress, the
            // temperature) still gets a particle — it's one of the
            // things the region is holding. Its id falls back to its own
            // text, which is unique enough within one module.
            id: pin.fact.storyId ?? `${pin.fact.moduleId}:${pin.fact.text}`,
            level: "story",
            label: pin.fact.text,
            position: pin.position,
            parent: site ?? anchor,
            moduleId: pin.fact.moduleId,
            storyId: pin.fact.storyId,
            fact: pin.fact,
        });
    });

    return nodes;
}

/**
 * Which particles are NAMED right now.
 *
 * The rule is one level at a time: the region's topics until you open
 * one, then that topic's stories. Never both, and never another topic's
 * stories — that's what "too much at once" meant.
 */
export function namedNodes(nodes: TopicNode[], openModuleId: string | null): TopicNode[] {
    if (!openModuleId) return nodes.filter((node) => node.level === "category");
    return nodes.filter((node) => node.level === "story" && node.moduleId === openModuleId);
}
