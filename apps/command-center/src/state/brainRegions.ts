/**
 * The Brain's clickable areas — the Dashboard's whole navigation model
 * now that the orbiting icon ring is gone (removed per explicit request:
 * the icons + ring crowded the scene and kept the brain small, so the
 * brain itself became the navigation surface instead).
 *
 * Each region is anchored at a real point on the brain's own point cloud
 * (state/neuralNetwork3D.ts, local space, roughly x ±0.93 / y -0.80..0.92
 * / z ±0.86 — see the anchors below, all verified to sit ON actual
 * geometry rather than floating in empty space). That single anchor
 * drives everything about the region:
 *   - where its 3D marker sits (BrainRegions3D)
 *   - which neurons light up when it's focused (regionNodes.ts)
 *   - how far the brain rotates to face it (regionYaw below)
 *   - which region a click on the brain body resolves to
 *     (regionAtLocalDirection below)
 *
 * There is deliberately no cerebellum region: the baked point cloud has
 * no cerebellum lobe (a marker down there would hang off the silhouette
 * in empty space — measured, not guessed), so the lower back is covered
 * by the stem region instead.
 *
 * `modules` names what belongs in each region. Several are wired up to
 * real data already (see regionContent/); the rest are the map of what
 * still has to be connected, and the panel says so plainly instead of
 * showing invented numbers. The unread-style badge counts that used to
 * sit on these were exactly such invented numbers, and went when the
 * live summaries arrived — a row saying "nothing scheduled" next to a
 * badge reading "5" is worse than no badge at all.
 */

export interface BrainRegionModule {
    id: string;
    icon: string;
    label: string;
    /**
     * What the module covers, in a few words. Shown on its row only
     * while it has no real data behind it — a module wired up in
     * regionContent/ shows its actual live state there instead (see
     * BrainRegionPanel).
     */
    description: string;
}

export interface BrainRegionDefinition {
    id: string;
    /** Anatomical name — the "where" (shown as the marker label). */
    label: string;
    /** What KIWI keeps there — the "what" (shown as the panel title). */
    domain: string;
    description: string;
    icon: string;
    /** CSS color for the panel/marker label. */
    color: string;
    /** Same color as 0-1 RGB, for the three.js side (marker + neurons). */
    rgb: [number, number, number];
    /** Surface point in the brain's own local space. */
    anchor: [number, number, number];
    /** Neurons within this distance of the anchor belong to the region. */
    radius: number;
    modules: BrainRegionModule[];
}

export const brainRegions: BrainRegionDefinition[] = [
    {
        id: "frontal",
        label: "Frontal Cortex",
        domain: "Plan & Decide",
        description: "Projects, schedule and money — everything with a deadline attached.",
        icon: "🧭",
        color: "#49C7FF",
        rgb: [0.29, 0.78, 1.0],
        anchor: [0, 0.4, 0.62],
        radius: 0.62,
        modules: [
            { id: "projects", icon: "📁", label: "Projects", description: "Goals · Progress · Planning" },
            { id: "calendar", icon: "📅", label: "Calendar", description: "Events · Tasks · Schedule" },
            { id: "finance", icon: "📈", label: "Finance", description: "Investments · Markets · Crypto" },
        ],
    },
    {
        id: "parietal",
        label: "Parietal Lobe",
        domain: "Know & Learn",
        description: "The knowledge base — documents, notes and everything you're studying.",
        icon: "📚",
        color: "#7566FF",
        rgb: [0.46, 0.4, 1.0],
        anchor: [0, 0.78, -0.12],
        radius: 0.62,
        modules: [
            { id: "documents", icon: "📄", label: "Documents", description: "Files · Notes · Knowledge base" },
            { id: "learning", icon: "📖", label: "Learning", description: "Courses · Books · Skills" },
            { id: "laboratory", icon: "🛰️", label: "Laboratory", description: "Open the build workspace" },
        ],
    },
    {
        id: "temporal-left",
        label: "Left Temporal",
        domain: "Talk & Connect",
        description: "Language side — mail, messages and the people behind them.",
        icon: "✉️",
        color: "#6EF3A5",
        rgb: [0.43, 0.95, 0.65],
        anchor: [-0.74, -0.18, 0.12],
        radius: 0.62,
        modules: [
            { id: "communication", icon: "✉️", label: "Communication", description: "Email · Messages · Contacts" },
            { id: "social", icon: "💬", label: "Social", description: "Facebook · Instagram · X" },
            { id: "voice", icon: "🎙️", label: "Hey Kiwi", description: "Voice conversation with KIWI" },
        ],
    },
    {
        id: "temporal-right",
        label: "Right Temporal",
        domain: "Feel & Explore",
        description: "The other hemisphere's half — music, shows, trips and time outdoors.",
        icon: "🎧",
        color: "#FF7AD5",
        rgb: [1.0, 0.48, 0.84],
        anchor: [0.74, -0.18, 0.12],
        radius: 0.62,
        modules: [
            { id: "entertainment", icon: "🎬", label: "Entertainment", description: "Music · Shows · Podcasts" },
            { id: "adventure", icon: "⛰️", label: "Adventure", description: "Trails · Weather · Gear" },
            { id: "travel", icon: "✈️", label: "Travel", description: "Flights · Stays · Itineraries" },
        ],
    },
    {
        id: "occipital",
        label: "Occipital Lobe",
        domain: "Watch & Read",
        description: "Incoming signal — news, space and the weather outside.",
        icon: "📡",
        color: "#FFC24B",
        rgb: [1.0, 0.76, 0.29],
        anchor: [0, 0.18, -0.7],
        radius: 0.62,
        modules: [
            { id: "news", icon: "📰", label: "News", description: "Real-time updates" },
            { id: "space", icon: "🚀", label: "Space", description: "Launches · Missions · Discoveries" },
            { id: "weather", icon: "🌤️", label: "Weather", description: "Now · Today · This week" },
        ],
    },
    {
        id: "stem",
        label: "Brain Stem",
        domain: "Run & Sustain",
        description: "Everything that keeps running underneath — body, systems, connections.",
        icon: "❤️",
        color: "#FF4F6D",
        rgb: [1.0, 0.31, 0.43],
        anchor: [0, -0.62, 0],
        radius: 0.5,
        modules: [
            { id: "health", icon: "❤️", label: "Health", description: "Activity · Sleep · Nutrition" },
            { id: "meals", icon: "🍳", label: "Meals", description: "Recipes · Menu · Groceries" },
            { id: "systems", icon: "⚙️", label: "Systems", description: "Connections · Devices · Status" },
        ],
    },
];

export function findBrainRegion(id: string | null): BrainRegionDefinition | null {
    if (!id) return null;
    return brainRegions.find((r) => r.id === id) ?? null;
}

// Below this horizontal distance from the brain's axis, an anchor is
// effectively straight up or straight down (parietal, stem) — no amount
// of Y-rotation brings it any closer to the camera, so those regions
// report no yaw at all rather than a meaningless half-turn (see
// regionYaw). BrainScene3D pans the camera vertically for those instead.
const VERTICAL_ANCHOR_LIMIT = 0.25;

/**
 * Y-rotation that swings a region's anchor around to sit in front of the
 * camera once it has flown INSIDE the brain (see BrainScene3D: opening a
 * region puts the camera inside the shell, looking along -Z, with the
 * network wrapped around it).
 *
 * The brain group only ever rotates around Y, so this is the anchor's
 * azimuth negated (which would bring it to front-center, i.e. +Z) plus a
 * half-turn, which carries it on round to -Z — the wall the camera is
 * actually looking at from in there. Without that half-turn the region
 * ended up directly BEHIND the viewer.
 *
 * Null for the top/bottom regions, where rotating would only spin the
 * region in place — the brain just holds still for those and the camera
 * rises/drops to their height instead.
 */
export function regionYaw(region: BrainRegionDefinition): number | null {
    const [x, , z] = region.anchor;
    if (Math.hypot(x, z) < VERTICAL_ANCHOR_LIMIT) return null;
    return -Math.atan2(x, z) + Math.PI;
}

/**
 * Which region a click on the brain body landed in.
 *
 * Matches on DIRECTION from the brain's center, not distance to the
 * anchor: the click comes from raycasting an invisible sphere that's
 * bigger than the brain itself (see BrainSystem3D's hit sphere), so the
 * hit point is never actually near an anchor — only the direction it
 * points is meaningful. `minDot` keeps clicks on the fissure/between
 * regions from snapping to a region that's most of a hemisphere away.
 */
export function regionAtLocalDirection(point: [number, number, number], minDot = 0.55): BrainRegionDefinition | null {
    const length = Math.hypot(point[0], point[1], point[2]);
    if (length === 0) return null;

    let best: BrainRegionDefinition | null = null;
    let bestDot = minDot;

    for (const region of brainRegions) {
        const [ax, ay, az] = region.anchor;
        const anchorLength = Math.hypot(ax, ay, az);
        const dot = (point[0] * ax + point[1] * ay + point[2] * az) / (length * anchorLength);
        if (dot > bestDot) {
            bestDot = dot;
            best = region;
        }
    }

    return best;
}
