import { useState } from "react";
import LaboratoryTopBar from "./LaboratoryTopBar";
import { resolveBackgroundImage, DEFAULT_BACKGROUND } from "../../state/backgrounds";
import "./Laboratory.css";

interface LaboratoryProps {
    onBack: () => void;
}

/**
 * Laboratory — a separate, focus-only workspace for building projects,
 * deliberately apart from the KIWI HQ dashboard (see App.tsx's view
 * switch). Reuses the Dashboard's own design tokens (src/styles/
 * theme.css) and default background so it reads as an obvious extension
 * of the same system rather than a different app, but is otherwise a
 * fully separate component tree under components/laboratory/ — nothing
 * here touches the Dashboard's own working files, and nothing in the
 * Dashboard depends on this existing.
 *
 * This is step 1 of a staged build: routing + the top bar + the KIWI
 * Core badge (the same brain used on the Dashboard, minus OrbitRing3D
 * — see KiwiCoreBadge). The actual workspace (Projects grid, project
 * detail, the Hey Kiwi panel) lands in the steps after this one, once
 * this foundation is confirmed working.
 *
 * Known gap for now: the profile pill shows a local placeholder name,
 * not whatever's actually signed in on the Dashboard — BrainScene3D's
 * account state (nickname/avatar/plan/...) is local to that component,
 * and lifting it into something both scenes can share is its own step,
 * not bundled into this one.
 */
export default function Laboratory({ onBack }: LaboratoryProps) {
    // Not wired to anything yet — KiwiPanel (which will actually drive
    // this) is a later step. Kept here so KiwiCoreBadge already reacts
    // the moment that panel exists, without touching this file again.
    const [listening] = useState(false);

    return (
        <div
            className="laboratory"
            style={{ backgroundImage: `linear-gradient(rgba(2,6,17,0.55), rgba(2,6,17,0.55)), ${resolveBackgroundImage(DEFAULT_BACKGROUND)}` }}
        >
            <LaboratoryTopBar onBack={onBack} listening={listening} />

            <main className="laboratory-main">
                <div className="laboratory-placeholder">
                    <span className="laboratory-placeholder-eyebrow">Laboratory</span>
                    <h1>Your workspace is taking shape</h1>
                    <p>Projects, research, and the Hey Kiwi panel land here next.</p>
                </div>
            </main>
        </div>
    );
}
