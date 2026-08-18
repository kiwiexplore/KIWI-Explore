import type { MouseEvent } from "react";
import { Info, Orbit, Satellite } from "lucide-react";
import ActivitySummary from "./ActivitySummary";
import SpotifyPlayerWidget from "../ui/SpotifyPlayerWidget";
import type { SpotifyState } from "../../state/spotify";
import "./TopBar.css";

interface TopBarProps {
    onInfoClick?: (event: MouseEvent<HTMLElement>) => void;
    onLaboratoryClick?: () => void;
    spotify: SpotifyState;
}

/**
 * Header row above the brain scene — brand mark (left), the "while you
 * were away" activity summary (center, moved here from above the brain
 * per explicit request), and a small tools pill on the right (music,
 * Laboratory, Info). The "System Online" status dot/label that used to
 * lead that pill is gone, also per explicit request. The "Hey Kiwi"
 * voice bar used to live centered here too; it's now along the bottom
 * of the scene instead (see BrainScene3D).
 *
 * There is deliberately no sign-in button or profile pill here any more
 * (removed per explicit request — the account isn't needed at this
 * stage). The account state itself still exists and is still editable
 * from Laboratory's own top bar; nothing about it is wired into this
 * scene except the chosen background.
 *
 * The "Laboratory" icon opens Laboratory — a separate, focus-only
 * workspace for designing/building projects, deliberately kept apart
 * from this HQ dashboard (see App.tsx's view switch and
 * components/laboratory/Laboratory.tsx). Left ungated (visible
 * regardless of plan) for now, while it's still being built —
 * `state/plans.ts` already models it as a Max-plan perk for later, once
 * there's a real reason to keep re-testing that gate.
 *
 * The "Info" icon opens the same DetailDrawer as everything else in this
 * scene (About/Terms/Privacy/Updates — see InfoPanel), anchored at its
 * own position.
 */
export default function TopBar({ onInfoClick, onLaboratoryClick, spotify }: TopBarProps) {
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
                <SpotifyPlayerWidget spotify={spotify} />
                <button type="button" className="top-bar-icon-btn" aria-label="Laboratory" onClick={onLaboratoryClick}>
                    <Satellite size={18} strokeWidth={1.75} />
                    <span className="top-bar-tooltip">Laboratory</span>
                </button>
                <button type="button" className="top-bar-icon-btn" aria-label="Info" onClick={onInfoClick}>
                    <Info size={18} strokeWidth={1.75} />
                    <span className="top-bar-tooltip">Info</span>
                </button>
            </div>
        </header>
    );
}
