import type { MouseEvent } from "react";
import { ArrowLeft, Bell, Calendar, ChevronDown, Search, UserCircle2 } from "lucide-react";
import KiwiCoreBadge from "./KiwiCoreBadge";
import LaboratoryStats from "./LaboratoryStats";
import AvatarGlyph from "../ui/AvatarGlyph";
import { DEFAULT_AVATAR, type AvatarChoice } from "../../state/avatars";
import "./LaboratoryTopBar.css";

interface LaboratoryTopBarProps {
    onBack: () => void;
    listening?: boolean;
    onOpenSearch?: () => void;
    onOpenCalendar?: () => void;
    onOpenNotifications?: () => void;
    unreadNotificationCount?: number;
    nickname: string | null;
    avatar: AvatarChoice;
    onProfileClick?: (event: MouseEvent<HTMLElement>) => void;
    projectCount: number;
    activeProjectCount: number;
    noteCount: number;
    researchCount: number;
}

/**
 * Laboratory's own top bar — mirrors TopBar's three-zone shape (brand /
 * center / account) but with different content: KIWI Core (the mini
 * brain, see KiwiCoreBadge) sits flush in the corner with nothing
 * before it, sized so the bar itself grows tall enough to fully
 * contain it. The "Dashboard" back button and KIWI/LABORATORY wordmark
 * sit to its right. The center used to have Projects/Research/Notes
 * nav tabs, but those just duplicated the left sidebar's own items
 * with nothing extra to offer — per explicit feedback, replaced with
 * LaboratoryStats (an at-a-glance summary) instead. Search, Calendar,
 * and Notifications sit next to the profile pill; Search opens a
 * quick cross-section lookup (LaboratorySearch), Calendar opens
 * CalendarPanel, Notifications opens NotificationsPanel — all owned by
 * Laboratory.tsx, same pattern as ProfileSettings. The "Hey Kiwi"
 * trigger itself now lives as a docked tab on the right edge (see
 * KiwiPanel.tsx) rather than a button up here, so opening it and where
 * it actually appears are the same place.
 *
 * `nickname`/`avatar` come from App.tsx's shared account state (see
 * state/account.ts) — signing in/changing your avatar on the Dashboard
 * shows up here too. Clicking the pill opens the exact same
 * ProfileSettings drawer as the Dashboard (see Laboratory.tsx, which
 * owns the anchor/DetailDrawer for it, same pattern as BrainScene3D).
 * Signed-out shows a plain "Sign in" prompt that just routes back to
 * the Dashboard, where that flow actually lives, rather than
 * duplicating SignUpForm here.
 *
 * Kept as its own component (not a TopBar variant) since the two
 * bars' contents genuinely diverge — the profile pill's markup/CSS is
 * deliberately duplicated here rather than importing TopBar.css, to
 * keep Laboratory decoupled from the Dashboard's own files (see
 * Laboratory.tsx's doc comment).
 */
export default function LaboratoryTopBar({
    onBack, listening, onOpenSearch, onOpenCalendar, onOpenNotifications, unreadNotificationCount = 0, nickname, avatar, onProfileClick,
    projectCount, activeProjectCount, noteCount, researchCount,
}: LaboratoryTopBarProps) {
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

            <LaboratoryStats
                projectCount={projectCount}
                activeProjectCount={activeProjectCount}
                noteCount={noteCount}
                researchCount={researchCount}
            />

            <div className="lab-topbar-account">
                <button type="button" className="lab-topbar-icon-btn" onClick={onOpenSearch} aria-label="Search">
                    <Search size={16} strokeWidth={1.75} />
                </button>
                <button type="button" className="lab-topbar-icon-btn" onClick={onOpenCalendar} aria-label="Calendar">
                    <Calendar size={16} strokeWidth={1.75} />
                </button>
                <button type="button" className="lab-topbar-icon-btn" onClick={onOpenNotifications} aria-label="Notifications">
                    <Bell size={16} strokeWidth={1.75} />
                    {unreadNotificationCount > 0 && (
                        <span className="lab-topbar-badge">{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>
                    )}
                </button>
                {nickname ? (
                    <button type="button" className="lab-topbar-profile" onClick={onProfileClick}>
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
