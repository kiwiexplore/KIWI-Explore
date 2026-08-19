import type { PlanetPalette } from "./spaceTextures";

/**
 * The Solar System: real orbits around the Sun, real relative sizes.
 *
 * Two things have to be true at once here, and they pull in opposite
 * directions, so they're computed separately:
 *
 *   - WHERE a planet is comes from its real orbit around the Sun. Mars
 *     is outside Earth's orbit, Jupiter far outside that, and so on out
 *     to Neptune. Orbit radii are compressed logarithmically to fit the
 *     scene, which keeps the order and the widening gaps.
 *   - HOW BIG it looks comes from its real angular size as seen from
 *     Earth: real diameter over real distance. That's worked out from
 *     the true orbital geometry, not from where things ended up in the
 *     compressed scene — otherwise compressing the distances would
 *     silently inflate the outer planets, which is exactly what made
 *     Saturn look wrong in an earlier version.
 *
 * Which settles a question worth writing down: from Earth, JUPITER looks
 * bigger than Mars, by a lot. Mars is closer, but it's tiny — 3,390 km
 * against Jupiter's 69,911, twenty times smaller, while Jupiter is only
 * about six times further away. Venus beats them both when it's near.
 *
 * Earth and the Moon aren't in this table: the scene is standing in
 * Earth-Moon space, so those two are placed by hand as the near
 * foreground (see SpaceBackdrop).
 */

export interface Planet {
    id: string;
    label: string;
    /** Equatorial radius in km. */
    radiusKm: number;
    /** Semi-major axis in astronomical units — its real orbit. */
    au: number;
    /** Where it currently sits on that orbit, in radians. */
    orbitAngle: number;
    /** Orbital inclination to the ecliptic, in degrees. */
    inclination: number;
    palette: PlanetPalette;
    rings?: { inner: number; outer: number; tilt: number };
}

// Earth's own place on its orbit, which every planet's distance from
// here is measured against.
const EARTH_AU = 1;
const EARTH_ORBIT_ANGLE = 0.35;

// The scene views the system from off to one side, so a planet's
// distance from the Sun ON SCREEN is not its orbit radius — it's the
// part of that radius that lies across the line of sight. A planet on
// the near or far side of its orbit collapses toward the Sun visually
// however far out it really is, which is exactly how Jupiter came to
// look closer in than Mars.
//
// The orbit angles below were therefore solved for rather than guessed:
// each is the point on that planet's real orbit which puts it at a
// chosen angular distance from the Sun in this view, while keeping it in
// front of the camera. The chosen distances rise with the orbit, so the
// order you SEE is the order that's actually out there — Mercury hugging
// the Sun, then Venus, Mars, Jupiter, Saturn, and the ice giants far
// out. (Simply taking each planet's maximum elongation doesn't work: the
// camera sits inside the outer orbits, so for those the maximum is more
// than 90 degrees and swings them behind the viewer.)

export const PLANETS: Planet[] = [
    {
        id: "mercury", label: "Mercury", radiusKm: 2440, au: 0.387,
        orbitAngle: 1.493, inclination: 7,
        palette: { base: "#8c8681", light: "#a39c95", dark: "#6d6862", banding: 0.1, mottle: 0.16 },
    },
    {
        id: "venus", label: "Venus", radiusKm: 6052, au: 0.723,
        orbitAngle: -2.512, inclination: 3.4,
        palette: { base: "#d8c9a3", light: "#eadcb8", dark: "#bda87f", banding: 0.18, mottle: 0.1 },
    },
    {
        // Close to Earth's own longitude, so it's about as near as Mars
        // ever gets — and therefore as large as it can honestly be —
        // while still, correctly, orbiting well outside Earth.
        id: "mars", label: "Mars", radiusKm: 3390, au: 1.524,
        orbitAngle: -2.672, inclination: 1.85,
        palette: { base: "#a4593a", light: "#c07350", dark: "#7d422b", banding: 0.12, mottle: 0.22 },
    },
    {
        id: "jupiter", label: "Jupiter", radiusKm: 69911, au: 5.203,
        orbitAngle: -2.712, inclination: 1.3,
        palette: { base: "#c4a98a", light: "#e0cbaa", dark: "#95755a", banding: 0.5, mottle: 0.18 },
    },
    {
        id: "saturn", label: "Saturn", radiusKm: 58232, au: 9.537,
        orbitAngle: -2.937, inclination: 2.5,
        palette: { base: "#d3bd8e", light: "#e8d6ad", dark: "#ac9469", banding: 0.34, mottle: 0.1 },
        // Ring radii as multiples of the planet's own radius (the real
        // C-to-A span is roughly 1.2 to 2.3), and the tilt they're
        // famously seen at.
        rings: { inner: 1.24, outer: 2.27, tilt: 0.47 },
    },
    {
        id: "uranus", label: "Uranus", radiusKm: 25362, au: 19.19,
        orbitAngle: 3.118, inclination: 0.77,
        palette: { base: "#93bfc4", light: "#aed4d8", dark: "#7aa4aa", banding: 0.14, mottle: 0.05 },
    },
    {
        id: "neptune", label: "Neptune", radiusKm: 24622, au: 30.07,
        orbitAngle: 2.993, inclination: 1.77,
        palette: { base: "#4a6ea8", light: "#6288bd", dark: "#385584", banding: 0.18, mottle: 0.08 },
    },
];

const KM_PER_AU = 149_597_871;

// Orbit radii in scene units. Tuned so 1 AU lands at the distance the
// scene already puts between the Sun and Earth, and compressed beyond
// that: Neptune at true scale would be thirty times further out than
// Earth, well past the star field. log1p keeps the ordering and the
// ever-widening gaps intact.
const ORBIT_UNIT = 39.9;
const ORBIT_SOFTNESS = 0.5;

export function orbitRadius(au: number): number {
    return ORBIT_UNIT * Math.log1p(au / ORBIT_SOFTNESS);
}

/** Real distance from Earth, in AU, from the two orbits' geometry. */
export function distanceFromEarth(planet: Planet): number {
    const separation = planet.orbitAngle - EARTH_ORBIT_ANGLE;
    return Math.sqrt(
        planet.au * planet.au + EARTH_AU * EARTH_AU
        - 2 * planet.au * EARTH_AU * Math.cos(separation),
    );
}

// How much every planet's true angular size is magnified. At their real
// angular sizes they'd be single pixels — this makes them visible, and
// because it's ONE factor for all of them, Jupiter stays bigger than
// Saturn stays bigger than Mars exactly as it should.
const ANGULAR_GAIN = 150;

/**
 * The radius to draw a planet at, given how far away it ends up in the
 * scene. Its apparent size then matches its real angular size from
 * Earth, whatever the compression did to the distances.
 */
export function planetRadius(planet: Planet, sceneDistance: number): number {
    const angularRadius = planet.radiusKm / (distanceFromEarth(planet) * KM_PER_AU);
    return angularRadius * ANGULAR_GAIN * sceneDistance;
}

/** A planet's position on its orbit, relative to the Sun. */
export function orbitOffset(planet: Planet): [number, number, number] {
    const radius = orbitRadius(planet.au);
    const inclination = (planet.inclination * Math.PI) / 180;

    // All the orbits share one plane (the ecliptic), each tilted by its
    // own small inclination — which is what makes the system read as a
    // system rather than as scattered dots.
    return [
        Math.cos(planet.orbitAngle) * radius,
        Math.sin(inclination) * radius * Math.sin(planet.orbitAngle),
        Math.sin(planet.orbitAngle) * radius * Math.cos(inclination),
    ];
}
