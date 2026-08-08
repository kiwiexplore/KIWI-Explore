import milkyWayPhoto from "../assets/milky-way-background.jpg";

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

export const DEFAULT_BACKGROUND: BackgroundChoice = { type: "preset", id: "milkyway" };

export function resolveBackgroundImage(choice: BackgroundChoice): string {
    if (choice.type === "custom") return `url(${choice.dataUrl})`;
    const preset = BACKGROUND_PRESETS.find((p) => p.id === choice.id) ?? BACKGROUND_PRESETS[0];
    return preset.css;
}
