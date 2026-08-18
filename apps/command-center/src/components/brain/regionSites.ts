import { brainNodes3D } from "../../state/neuralNetwork3D";
import { KEPT_NODE_INDICES } from "./keptNodes";
import type { BrainRegionDefinition } from "../../state/brainRegions";

// Sites sit slightly proud of the neuron they're anchored to, so a
// label there floats just off the surface rather than inside the cloud.
const SITE_LIFT = 1.05;
// Minimum distance between two sites (local units): picking the nearest
// neurons to a region's anchor would huddle every module in one spot.
const MIN_SPACING = 0.3;
// Sites are only taken from the inner part of a region, so a module
// never ends up out on the boundary with the next area.
const SITE_RADIUS_FRACTION = 0.85;

const siteCache = new Map<string, Map<string, [number, number, number]>>();

/**
 * Where each of a region's modules LIVES inside the brain.
 *
 * One real neuron per module, spread across the region: greedily walk
 * its own neurons (the same radius test used everywhere else) and keep
 * the ones far enough from every site already taken.
 *
 * Shared by the pins that sit on those spots (RegionDataPins) and by the
 * camera that turns to face one when its module is opened (see
 * BrainScene3D). Both have to agree on where a topic is — that's the
 * whole reason this lives in its own module rather than inside either of
 * them — and being keyed by module id rather than by position in a list
 * means a module keeps its place as its data comes and goes.
 */
export function regionSites(region: BrainRegionDefinition): Map<string, [number, number, number]> {
    const cached = siteCache.get(region.id);
    if (cached) return cached;

    const sites = new Map<string, [number, number, number]>();
    const taken: [number, number, number][] = [];

    for (const index of KEPT_NODE_INDICES) {
        if (sites.size >= region.modules.length) break;

        const x = brainNodes3D[index * 3], y = brainNodes3D[index * 3 + 1], z = brainNodes3D[index * 3 + 2];
        const dx = x - region.anchor[0], dy = y - region.anchor[1], dz = z - region.anchor[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) > region.radius * SITE_RADIUS_FRACTION) continue;

        const position: [number, number, number] = [x * SITE_LIFT, y * SITE_LIFT, z * SITE_LIFT];
        const tooClose = taken.some(([tx, ty, tz]) => {
            const sx = tx - position[0], sy = ty - position[1], sz = tz - position[2];
            return Math.sqrt(sx * sx + sy * sy + sz * sz) < MIN_SPACING;
        });
        if (tooClose) continue;

        taken.push(position);
        sites.set(region.modules[sites.size].id, position);
    }

    siteCache.set(region.id, sites);
    return sites;
}
