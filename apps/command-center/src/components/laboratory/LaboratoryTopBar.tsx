import { useState } from "react";
import { ArrowLeft, AudioLines, ChevronDown } from "lucide-react";
import KiwiCoreBadge from "./KiwiCoreBadge";
import AvatarGlyph from "../ui/AvatarGlyph";
import { DEFAULT_AVATAR } from "../../state/avatars";
import "./LaboratoryTopBar.css";

const NAV_TABS = [
    { id: "projects", label: "Projects", enabled: true },
    { id: "research", label: "Research", enabled: false },
    { id: "notes", label: "Notes", enabled: false },
];

interface LaboratoryTopBarProps {
    onBack: () => void;
    listening?: boolean;
}

/**
 * Laboratory's own top bar — mirrors TopBar's three-zone shape (brand /
 * center / account) but with different content: KIWI Core (the mini
 * brain, see KiwiCoreBadge) sits flush in the corner with nothing
 * before it, deliberately oversized and NOT constrained to the bar's
 * own (slim, like the Dashboard's TopBar) height — it's absolutely
 * positioned so it visually floats/overflows down past the bar's own
 * bottom edge into the page below, rather than stretching the whole
 * bar taller just to contain it. The "Dashboard" back button and
 * KIWI/LABORATORY wordmark sit to its right (space reserved via
 * .lab-topbar-brand's own padding-left). A nav tab row stands in for
 * the activity summary, and a "Hey Kiwi" trigger sits next to the
 * profile pill (not wired to anything yet — KiwiPanel is a later
 * step). Kept as its own component (not a TopBar variant) since the
 * two bars' contents genuinely diverge — the profile pill's markup/CSS
 * is deliberately duplicated here rather than importing TopBar.css, to
 * keep Laboratory decoupled from the Dashboard's own files (see
 * Laboratory.tsx's doc comment).
 */
export default function LaboratoryTopBar({ onBack, listening }: LaboratoryTopBarProps) {
    const [activeTab, setActiveTab] = useState("projects");
    // Local placeholder identity — Laboratory doesn't share BrainScene3D's
    // account state yet (see Laboratory.tsx's doc comment for why).
    const nickname = "Explorer";

    return (
        <header className="lab-topbar">
            <div className="lab-topbar-brand">
                <div className="lab-topbar-core-anchor">
                    <KiwiCoreBadge listening={listening} />
                </div>
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
                        className={`lab-topbar-tab${activeTab === tab.id ? " lab-topbar-tab-active" : ""}`}
                        onClick={() => tab.enabled && setActiveTab(tab.id)}
                        disabled={!tab.enabled}
                    >
                        {tab.label}
                        {!tab.enabled && <span className="lab-topbar-tab-badge">Soon</span>}
                    </button>
                ))}
            </nav>

            <div className="lab-topbar-account">
                <button type="button" className="lab-topbar-kiwi-btn">
                    <AudioLines size={15} strokeWidth={1.75} />
                    Hey Kiwi
                </button>
                <button type="button" className="lab-topbar-profile">
                    <AvatarGlyph avatar={DEFAULT_AVATAR} size={18} iconSize={18} />
                    {nickname}
                    <ChevronDown size={13} strokeWidth={2} />
                </button>
            </div>
        </header>
    );
}
