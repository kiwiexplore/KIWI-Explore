import type { MouseEvent } from "react";
import { Info, Orbit, Satellite, UserCircle2 } from "lucide-react";
import ActivitySummary from "./ActivitySummary";
import AvatarGlyph from "../ui/AvatarGlyph";
import SpotifyPlayerWidget from "../ui/SpotifyPlayerWidget";
import { DEFAULT_AVATAR, type AvatarChoice } from "../../state/avatars";
import type { SpotifyState } from "../../state/spotify";
import "./TopBar.css";

interface TopBarProps {
    nickname?: string | null;
    onSignInClick?: (event: MouseEvent<HTMLElement>) => void;
    onProfileClick?: (event: MouseEvent<HTMLElement>) => void;
    onInfoClick?: (event: MouseEvent<HTMLElement>) => void;
    onLaboratoryClick?: () => void;
    // Mirrors whatever's picked in Profile & settings (see AvatarGlyph)
    // so the pill here always matches the drawer's own avatar.
    avatar?: AvatarChoice;
    spotify: SpotifyState;
}

/**
 * Header row above the brain scene — brand mark (left), the "while you
 * were away" activity summary (center, same vertical level as the
 * System Online status pill — moved here from above the brain per
 * explicit request), and a login/system-status area (right). The
 * "Hey Kiwi" voice bar used to live centered here too; it's now below
 * the brain instead (see BrainScene3D), where it has proper room now
 * that the bottom widget row is gone. When `nickname` is set the
 * sign-in button is replaced with a profile pill instead — both just
 * fire their click handler with the event so BrainScene3D can anchor a
 * detail card at the button's own position, same as every other card in
 * this scene.
 *
 * The "Laboratory" icon opens Laboratory — a separate, focus-only
 * workspace for designing/building projects, deliberately kept apart
 * from this HQ dashboard (see App.tsx's view switch and
 * components/laboratory/Laboratory.tsx). Left ungated (visible
 * regardless of sign-in/plan) for now, while it's still being built —
 * `state/plans.ts` already models it as a Max-plan perk for later, once
 * there's a real reason to keep re-testing that gate.
 *
 * The "Info" icon opens the same DetailDrawer as everything else in this
 * scene (About/Terms/Privacy/Updates — see InfoPanel), anchored at its
 * own position, same pattern as Sign in/Profile.
 */
export default function TopBar({ nickname, onSignInClick, onProfileClick, onInfoClick, onLaboratoryClick, avatar, spotify }: TopBarProps) {
    return (
        <header className="top-bar">
            <div className="top-bar-brand">
                <Orbit size={24} color="#49C7FF" strokeWidth={1.5} />
                <span className="top-bar-brand-text">
                    KIWI <span className="top-bar-brand-accent">AI Operation System</span>
                </span>
            </div>

            <div className="top-bar-center">
                <ActivitySummary />
            </div>

            <div className="top-bar-status">
                <span className="top-bar-status-dot" />
                <span className="top-bar-status-text">System Online</span>
                <span className="top-bar-status-divider" />
                <SpotifyPlayerWidget spotify={spotify} />
                <button type="button" className="top-bar-icon-btn" aria-label="Laboratory" onClick={onLaboratoryClick}>
                    <Satellite size={18} strokeWidth={1.75} />
                    <span className="top-bar-tooltip">Laboratory</span>
                </button>
                <button type="button" className="top-bar-icon-btn" aria-label="Info" onClick={onInfoClick}>
                    <Info size={18} strokeWidth={1.75} />
                    <span className="top-bar-tooltip">Info</span>
                </button>
                {nickname ? (
                    <button type="button" className="top-bar-profile" onClick={onProfileClick}>
                        <AvatarGlyph avatar={avatar ?? DEFAULT_AVATAR} size={18} iconSize={18} />
                        {nickname}
                    </button>
                ) : (
                    <button type="button" className="top-bar-signin" onClick={onSignInClick}>
                        <UserCircle2 size={18} strokeWidth={1.75} />
                        Sign in
                    </button>
                )}
            </div>
        </header>
    );
}
