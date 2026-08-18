import { brainNodes3D } from "../../state/neuralNetwork3D";
import { KEPT_NODE_INDICES } from "./keptNodes";
import { regionSites } from "./regionSites";
import type { RegionFact } from "./regionContent/regionFacts";
import type { BrainRegionDefinition } from "../../state/brainRegions";

// Pins sit slightly proud of the neuron they're on, the same lift the
// module sites use, so a label floats just off the surface.
const SITE_LIFT = 1.05;
// How far from its module's own spot one of that module's facts may be
// pinned — wide ACROSS, shallow up and down (per explicit request).
//
// The two aren't the same thing to read. Sideways room is what the eye
// has: labels sit in a row and stay apart. Stacking them vertically
// puts one headline directly above another at the same bearing, which
// is where a wall of pins turns into a wall of text. So a fact may
// wander well out to either side of its module and hardly at all above
// or below it.
const FACT_SPREAD_ACROSS = 0.62;
const FACT_SPREAD_UP = 0.24;
// Closest two pins may be pinned. This is what actually stops labels
// covering each other, and it's measured against every pin in the
// region rather than per module — two modules' corners meeting would
// otherwise overlap at the seam.
const FACT_SPACING = 0.16;
// Ceiling per module, so a feed that suddenly returns two hundred items
// can't turn one wall into a wall of text (or walk the whole node list
// looking for room that isn't there).
const MAX_PER_MODULE = 40;
// Facts past the last free neuron fan out around their module's spot
// instead — nothing is ever dropped for want of a place to sit.
const OVERFLOW_OFFSET = 0.16;

export interface RegionPin {
    fact: RegionFact;
    position: [number, number, number];
}

const spotCache = new Map<string, Map<string, [number, number, number][]>>();

/**
 * Somewhere to pin every one of a module's facts: real neurons around
 * that module's own site, spaced far enough apart to stay readable.
 *
 * One pass over the region's neurons, each claimed by the module whose
 * site it's nearest to. Cached per region — the node list doesn't
 * change, so neither does the answer, and this runs while the camera is
 * flying in.
 */
function factSpots(region: BrainRegionDefinition): Map<string, [number, number, number][]> {
    const cached = spotCache.get(region.id);
    if (cached) return cached;

    const sites = regionSites(region);
    const spots = new Map<string, [number, number, number][]>();
    sites.forEach((site, moduleId) => spots.set(moduleId, [site]));

    const taken: [number, number, number][] = [...sites.values()];

    for (const index of KEPT_NODE_INDICES) {
        const position: [number, number, number] = [
            brainNodes3D[index * 3] * SITE_LIFT,
            brainNodes3D[index * 3 + 1] * SITE_LIFT,
            brainNodes3D[index * 3 + 2] * SITE_LIFT,
        ];

        // Whichever module's corner this neuron falls in, if any —
        // measured in an ellipsoid that's wide across and flat
        // vertically, so "near enough to belong to this module" reaches
        // much further sideways than up.
        let owner: string | null = null;
        let nearest = 1;
        sites.forEach((site, moduleId) => {
            const across = Math.hypot(position[0] - site[0], position[2] - site[2]) / FACT_SPREAD_ACROSS;
            const up = (position[1] - site[1]) / FACT_SPREAD_UP;
            const distance = Math.hypot(across, up);
            if (distance < nearest) {
                nearest = distance;
                owner = moduleId;
            }
        });
        if (owner === null) continue;

        const list = spots.get(owner);
        if (!list || list.length >= MAX_PER_MODULE) continue;

        const tooClose = taken.some(([tx, ty, tz]) =>
            Math.hypot(tx - position[0], ty - position[1], tz - position[2]) < FACT_SPACING);
        if (tooClose) continue;

        taken.push(position);
        list.push(position);
    }

    spotCache.set(region.id, spots);
    return spots;
}

/**
 * Where each of the open region's facts sits inside it.
 *
 * EVERY fact gets a pin (per explicit request) — the wall shows the
 * whole list, not a sample of it. They're spread over the region's own
 * neurons around the module each one came from, rather than stacked on
 * a single spot, which is what makes a full wall readable at all.
 *
 * Its own module rather than a useMemo inside RegionDataPins because
 * two places need the answer and they have to agree exactly: the pins
 * are drawn at these points, and the camera turns to one of them when
 * its story is opened from the panel (see BrainScene3D). A pin the
 * camera turns to somewhere else is worse than no pin.
 */
export function regionPins(region: BrainRegionDefinition | null, facts: RegionFact[]): RegionPin[] {
    if (!region) return [];

    const sites = regionSites(region);
    const spots = factSpots(region);
    const usedPerModule = new Map<string, number>();

    return facts.flatMap((fact) => {
        const site = sites.get(fact.moduleId);
        if (!site) return [];

        const used = usedPerModule.get(fact.moduleId) ?? 0;
        usedPerModule.set(fact.moduleId, used + 1);

        const spot = spots.get(fact.moduleId)?.[used];
        if (spot) return [{ fact, position: spot }];

        // Out of neurons: fan the rest around the module's own spot.
        const overflow = used - (spots.get(fact.moduleId)?.length ?? 0) + 1;
        const angle = overflow * 2.4;
        return [{
            fact,
            position: [
                site[0] + Math.cos(angle) * OVERFLOW_OFFSET * overflow,
                site[1] + Math.sin(angle) * OVERFLOW_OFFSET * overflow,
                site[2] + Math.sin(angle * 0.7) * OVERFLOW_OFFSET * overflow,
            ],
        }];
    });
}
