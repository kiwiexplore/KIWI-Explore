import { Bot, Cat, Rocket, Sparkles, Star, UserCircle2, type LucideIcon } from "lucide-react";

/**
 * The account avatar picker — a small built-in set of icon presets plus
 * "upload your own", same shape as state/backgrounds.ts. Presets are
 * lucide icons (no extra image assets to source/ship); a custom upload
 * is stored as a data URL, same client-side-only mock as everything
 * else in the account system.
 */
export interface AvatarPreset {
    id: string;
    label: string;
    Icon: LucideIcon;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
    { id: "default", label: "Default", Icon: UserCircle2 },
    { id: "rocket", label: "Rocket", Icon: Rocket },
    { id: "sparkles", label: "Sparkles", Icon: Sparkles },
    { id: "bot", label: "Bot", Icon: Bot },
    { id: "cat", label: "Cat", Icon: Cat },
    { id: "star", label: "Star", Icon: Star },
];

export type AvatarChoice =
    | { type: "preset"; id: string }
    | { type: "custom"; dataUrl: string };

export const DEFAULT_AVATAR: AvatarChoice = { type: "preset", id: "default" };

export function getAvatarPreset(id: string): AvatarPreset {
    return AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0];
}
