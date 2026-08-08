import type { MouseEvent } from "react";
import { Info, Orbit, Satellite, UserCircle2 } from "lucide-react";
import ActivitySummary from "./ActivitySummary";
import "./TopBar.css";

interface TopBarProps {
    nickname?: string | null;
    onSignInClick?: (event: MouseEvent<HTMLElement>) => void;
    onProfileClick?: (event: MouseEvent<HTMLElement>) => void;
    onInfoClick?: (event: MouseEvent<HTMLElement>) => void;
    // Space Laboratory is a Max-plan perk (see state/plans.ts) — hidden
    // entirely below that tier rather than shown-but-disabled, since
    // there's no destination behind it yet either way.
    hasLab?: boolean;
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
 * The "Space Laboratory" icon is also a placeholder — it's planned to
 * later open a separate, focus-only window for designing/building
 * physical projects, deliberately kept apart from this HQ dashboard.
 * Just the icon + hover label for now, no destination yet.
 *
 * The "Info" icon opens the same DetailDrawer as everything else in this
 * scene (About/Terms/Privacy/Updates — see InfoPanel), anchored at its
 * own position, same pattern as Sign in/Profile.
 */
export default function TopBar({ nickname, onSignInClick, onProfileClick, onInfoClick, hasLab }: TopBarProps) {
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
                {hasLab && (
                    <button type="button" className="top-bar-icon-btn" aria-label="Space Laboratory">
                        <Satellite size={18} strokeWidth={1.75} />
                        <span className="top-bar-tooltip">Space Laboratory</span>
                    </button>
                )}
                <button type="button" className="top-bar-icon-btn" aria-label="Info" onClick={onInfoClick}>
                    <Info size={18} strokeWidth={1.75} />
                    <span className="top-bar-tooltip">Info</span>
                </button>
                {nickname ? (
                    <button type="button" className="top-bar-profile" onClick={onProfileClick}>
                        <UserCircle2 size={18} strokeWidth={1.75} />
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
