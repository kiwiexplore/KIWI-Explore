import { AudioLines, ArrowLeft, ChevronDown, UserCircle2 } from "lucide-react";
import KiwiCoreBadge from "./KiwiCoreBadge";
import AvatarGlyph from "../ui/AvatarGlyph";
import { DEFAULT_AVATAR, type AvatarChoice } from "../../state/avatars";
import type { LaboratorySection } from "./Laboratory";
import "./LaboratoryTopBar.css";

const NAV_TABS: { id: LaboratorySection; label: string }[] = [
    { id: "projects", label: "Projects" },
    { id: "research", label: "Research" },
    { id: "notes", label: "Notes" },
];

interface LaboratoryTopBarProps {
    onBack: () => void;
    listening?: boolean;
    onOpenKiwi?: () => void;
    section: LaboratorySection;
    onSectionChange: (section: LaboratorySection) => void;
    nickname: string | null;
    avatar: AvatarChoice;
}

/**
 * Laboratory's own top bar — mirrors TopBar's three-zone shape (brand /
 * center / account) but with different content: KIWI Core (the mini
 * brain, see KiwiCoreBadge) sits flush in the corner with nothing
 * before it, sized so the bar itself grows tall enough to fully
 * contain it. The "Dashboard" back button and KIWI/LABORATORY wordmark
 * sit to its right. The nav tab row is controlled from Laboratory.tsx
 * (via `section`/`onSectionChange`) rather than owning its own local
 * state, since which section is active determines what the whole page
 * renders below, not just this bar's own look. A "Hey Kiwi" trigger
 * opens KiwiPanel (a right-side sheet — see Laboratory.tsx, which owns
 * the shared chat state via useKiwiChat) next to the profile pill.
 *
 * `nickname`/`avatar` come from App.tsx's shared account state (see
 * state/account.ts) — signing in/changing your avatar on the Dashboard
 * shows up here too. This pill is read-only, though: there's no
 * sign-in form or ProfileSettings drawer here, so signed-out shows a
 * plain "Sign in" prompt that just routes back to the Dashboard, where
 * that flow actually lives, rather than duplicating it.
 *
 * Kept as its own component (not a TopBar variant) since the two
 * bars' contents genuinely diverge — the profile pill's markup/CSS is
 * deliberately duplicated here rather than importing TopBar.css, to
 * keep Laboratory decoupled from the Dashboard's own files (see
 * Laboratory.tsx's doc comment).
 */
export default function LaboratoryTopBar({ onBack, listening, onOpenKiwi, section, onSectionChange, nickname, avatar }: LaboratoryTopBarProps) {
    return (
        <header className="lab-topbar">
            <div className="lab-topbar-brand">
                <KiwiCoreBadge listening={listening} />
                <button type="button" className="lab-topbar-back" onClick={onBack} aria-label="Back to Dashboard">
                    <ArrowLeft size={16} strokeWidth={2} />
                    Dashboard
                </button>
                <span className="lab-topbar-brand-text">
                    KIWI
                    <span className="lab-topbar-brand-sub">
                        LABORATORY
                        <span className="lab-topbar-brand-tag">LAB</span>
                    </span>
                </span>
            </div>

            <nav className="lab-topbar-nav">
                {NAV_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`lab-topbar-tab${section === tab.id ? " lab-topbar-tab-active" : ""}`}
                        onClick={() => onSectionChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            <div className="lab-topbar-account">
                <button type="button" className="lab-topbar-kiwi-btn" onClick={onOpenKiwi}>
                    <AudioLines size={15} strokeWidth={1.75} />
                    Hey Kiwi
                </button>
                {nickname ? (
                    <button type="button" className="lab-topbar-profile">
                        <AvatarGlyph avatar={avatar ?? DEFAULT_AVATAR} size={18} iconSize={18} />
                        {nickname}
                        <ChevronDown size={13} strokeWidth={2} />
                    </button>
                ) : (
                    <button type="button" className="lab-topbar-signin" onClick={onBack} aria-label="Sign in on the Dashboard">
                        <UserCircle2 size={18} strokeWidth={1.75} />
                        Sign in
                    </button>
                )}
            </div>
        </header>
    );
}
