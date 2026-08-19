import milkyWayPhoto from "../assets/milky-way-background.jpg";
import { getMoonscapeUrl } from "../components/laboratory/moonscape";

/**
 * The dashboard's background picker — a small built-in gallery plus
 * "upload your own". The gallery is CSS gradients (no extra image
 * assets to source/ship) except the original Milky Way photo, which
 * stays as the default option.
 */
export interface BackgroundPreset {
    id: string;
    label: string;
    css: string; // a valid CSS background-image value (gradient or url(...))
    swatch: string; // a cheap CSS background for the small picker thumbnail
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
    {
        id: "moonscape",
        label: "Moon",
        // Drawn at first use rather than shipped, so `css` is filled in
        // by resolveBackgroundImage instead of sitting here — see
        // laboratory/moonscape.ts.
        css: "",
        swatch: "linear-gradient(#05070d 0%, #05070d 52%, #b6b2a9 52%, #5a574e 100%)",
    },
    {
        id: "milkyway",
        label: "Milky Way",
        css: `url(${milkyWayPhoto})`,
        swatch: `url(${milkyWayPhoto}) center / cover`,
    },
    {
        id: "nebula",
        label: "Nebula",
        css: "radial-gradient(ellipse at 30% 20%, #6b3fa0 0%, #2a1050 45%, #05030a 100%)",
        swatch: "radial-gradient(ellipse at 30% 20%, #6b3fa0 0%, #2a1050 45%, #05030a 100%)",
    },
    {
        id: "deep-space",
        label: "Deep Space",
        css: "radial-gradient(ellipse at 50% 50%, #142238 0%, #05070c 70%)",
        swatch: "radial-gradient(ellipse at 50% 50%, #142238 0%, #05070c 70%)",
    },
    {
        id: "aurora",
        label: "Aurora",
        css: "radial-gradient(ellipse at 60% 30%, #0d5c53 0%, #0a2e4a 45%, #05070c 100%)",
        swatch: "radial-gradient(ellipse at 60% 30%, #0d5c53 0%, #0a2e4a 45%, #05070c 100%)",
    },
];

export type BackgroundChoice =
    | { type: "preset"; id: string }
    | { type: "custom"; dataUrl: string };

// The Laboratory is ON the Moon: the camera flies out to it from the
// dashboard and lands here (see BrainScene3D's departure), so the room
// it lands in has the surface outside its windows.
export const DEFAULT_BACKGROUND: BackgroundChoice = { type: "preset", id: "moonscape" };

export function resolveBackgroundImage(choice: BackgroundChoice): string {
    if (choice.type === "custom") return `url(${choice.dataUrl})`;
    const preset = BACKGROUND_PRESETS.find((p) => p.id === choice.id) ?? BACKGROUND_PRESETS[0];
    // The moonscape is generated, and generated LAZILY: a 2560×1440
    // canvas is a tenth of a second's work, and doing it at import time
    // would spend it before the dashboard has drawn a single frame,
    // for a background only the Laboratory ever shows.
    if (preset.id === "moonscape") return `url(${getMoonscapeUrl()})`;
    return preset.css;
}
