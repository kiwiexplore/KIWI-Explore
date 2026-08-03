const CYAN = [0.3, 0.85, 1.0];
const BLUE = [0.26, 0.44, 0.98];
const DARK_BLUE = [0.08, 0.13, 0.4]; // deep navy — sits between blue and the pink for more variety
const MAGENTA = [0.72, 0.16, 0.6]; // nebula pink — a "space color" outside the plain cyan/blue family

// Ordered gradient stops the swirl travels through. Adding a stop is just
// adding an entry here — brainSwirlColor() below walks N-1 segments
// generically rather than hard-coding a fixed count. Purple and gold
// stops were removed per feedback — cyan/blue/navy/pink only now.
const STOPS = [CYAN, BLUE, DARK_BLUE, MAGENTA];

// Slow, independent speeds per axis-term so the swirl morphs organically
// instead of sliding as one uniform wave.
const SPEED_A = 0.025;
const SPEED_B = 0.018;
const SPEED_C = 0.02;

function lerp3(a: number[], b: number[], t: number): number[] {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Shared cyan → blue → dark blue → magenta swirl used by both NeuronLayer
 * (ambient node colors) and EnergyLayer (pulse colors) so the traveling
 * pulses read as part of the same living color field as the neurons
 * around them, not a separate white spark layered on top.
 */
export function brainSwirlColor(x: number, y: number, z: number, time: number): number[] {
    const phaseA = time * SPEED_A;
    const phaseB = time * SPEED_B;
    const phaseC = time * SPEED_C;

    // Spatial frequencies bumped well up from an earlier "big, slow
    // bands" version (per feedback then) — those low frequencies meant
    // the whole brain read as just two smooth halves, one hue next to
    // another, rather than a mix of colors scattered across it. Higher
    // frequencies make the field vary noticeably from one nearby point
    // to the next, breaking that macro-scale split into a genuine mix
    // at "random" locations, while still shifting smoothly over time.
    const swirl =
        Math.sin(x * 4.2 + y * 3.1 + phaseA) * 0.5 +
        Math.sin(y * 3.8 - z * 3.5 + phaseB) * 0.3 +
        Math.sin(z * 3.6 + x * 2.9 - phaseC) * 0.2;
    const raw = (swirl + 1) / 2;
    // Summing several sines pulls most values toward the middle of the
    // range — this contrast stretch pushes them back out toward the
    // extremes so every stop actually shows up instead of everything
    // reading as some shade of blue.
    const t = Math.max(0, Math.min(1, 0.5 + (raw - 0.5) * 1.7));

    const segments = STOPS.length - 1;
    const scaled = t * segments;
    const segIndex = Math.min(segments - 1, Math.floor(scaled));
    return lerp3(STOPS[segIndex], STOPS[segIndex + 1], scaled - segIndex);
}
