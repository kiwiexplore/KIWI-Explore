import { brainNodes3D } from "../../state/neuralNetwork3D";
import { brainRegions } from "../../state/brainRegions";
import { KEPT_NODE_INDICES } from "./keptNodes";

/**
 * Which region (if any) each VISIBLE neuron belongs to — indexed the same
 * way NeuronLayer indexes its own buffers (position n = KEPT_NODE_INDICES[n]),
 * so highlighting a region is a straight array lookup per node in the
 * render loop rather than a distance test per node per frame.
 *
 * Assignment is nearest-anchor-within-radius, so the ~19% of neurons that
 * sit between regions stay unassigned (-1) on purpose: that gap is what
 * makes a focused region read as a distinct lit-up area instead of the
 * whole brain changing color at once.
 *
 * Built once at module load — the anchors are static data, and this is
 * the same "compute the expensive part once, outside React" pattern as
 * keptNodes.ts / connectionGeometry.ts.
 */
function buildNodeRegions(): Int8Array {
    const map = new Int8Array(KEPT_NODE_INDICES.length).fill(-1);

    KEPT_NODE_INDICES.forEach((nodeIndex, n) => {
        const x = brainNodes3D[nodeIndex * 3];
        const y = brainNodes3D[nodeIndex * 3 + 1];
        const z = brainNodes3D[nodeIndex * 3 + 2];

        let best = -1;
        let bestDistance = Infinity;

        brainRegions.forEach((region, regionIndex) => {
            const dx = x - region.anchor[0];
            const dy = y - region.anchor[1];
            const dz = z - region.anchor[2];
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (distance <= region.radius && distance < bestDistance) {
                bestDistance = distance;
                best = regionIndex;
            }
        });

        map[n] = best;
    });

    return map;
}

export const nodeRegionIndex: Int8Array = buildNodeRegions();

export function regionIndexOf(regionId: string | null): number {
    if (!regionId) return -1;
    return brainRegions.findIndex((r) => r.id === regionId);
}
