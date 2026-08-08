import { getAvatarPreset, type AvatarChoice } from "../../state/avatars";

interface AvatarGlyphProps {
    avatar: AvatarChoice;
    size: number; // rendered square size in px
    iconSize?: number; // preset icon size override — defaults to size * 0.55 (matches the original fixed 26px icon inside a 48px circle)
}

/**
 * Renders the account avatar (see state/avatars.ts) — either a lucide
 * preset icon or a custom uploaded photo — used in both the Profile &
 * settings panel's big avatar and TopBar's small profile pill, so both
 * stay in sync with whatever the user picked.
 */
export default function AvatarGlyph({ avatar, size, iconSize }: AvatarGlyphProps) {
    if (avatar.type === "custom") {
        return (
            <img
                src={avatar.dataUrl}
                alt=""
                style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
            />
        );
    }
    const { Icon } = getAvatarPreset(avatar.id);
    return <Icon size={iconSize ?? Math.round(size * 0.55)} strokeWidth={1.5} />;
}
