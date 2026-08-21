import { ArrowLeft, Bell, Calendar, Search } from "lucide-react";
import MailButton from "../ui/MailButton";
import KiwiCoreBadge from "./KiwiCoreBadge";
import LaboratoryStats from "./LaboratoryStats";
import SpotifyPlayerWidget from "../ui/SpotifyPlayerWidget";
import type { SpotifyState } from "../../state/spotify";
import "./LaboratoryTopBar.css";

interface LaboratoryTopBarProps {
    onBack: () => void;
    listening?: boolean;
    onOpenSearch?: () => void;
    onOpenCalendar?: () => void;
    onOpenNotifications?: () => void;
    unreadNotificationCount?: number;
    videoCount: number;
    inProgressCount: number;
    publishedCount: number;
    failedCount: number;
    spotify: SpotifyState;
}

/**
 * Laboratory's own top bar — mirrors TopBar's three-zone shape (brand /
 * center / tools) but with different content: KIWI Core (the mini
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
 * Laboratory.tsx. The "Hey Kiwi"
 * trigger itself now lives as a docked tab on the right edge (see
 * KiwiPanel.tsx) rather than a button up here, so opening it and where
 * it actually appears are the same place.
 *
 * There is no profile pill or sign-in button here any more (removed
 * per explicit request, along with the Dashboard's own — the account
 * isn't needed at this stage), so this bar ends at Notifications.
 *
 * Kept as its own component (not a TopBar variant) since the two
 * bars' contents genuinely diverge, and to keep Laboratory decoupled
 * from the Dashboard's own files (see Laboratory.tsx's doc comment).
 */
export default function LaboratoryTopBar({
    onBack, listening, onOpenSearch, onOpenCalendar, onOpenNotifications, unreadNotificationCount = 0,
    videoCount, inProgressCount, publishedCount, failedCount, spotify,
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
                videoCount={videoCount}
                inProgressCount={inProgressCount}
                publishedCount={publishedCount}
                failedCount={failedCount}
            />

            <div className="lab-topbar-account">
                <SpotifyPlayerWidget spotify={spotify} />
                <button type="button" className="lab-topbar-icon-btn" onClick={onOpenSearch} aria-label="Search">
                    <Search size={16} strokeWidth={1.75} />
                </button>
                <MailButton className="lab-topbar-icon-btn" badgeClassName="lab-topbar-badge" />
                <button type="button" className="lab-topbar-icon-btn" onClick={onOpenCalendar} aria-label="Calendar">
                    <Calendar size={16} strokeWidth={1.75} />
                </button>
                <button type="button" className="lab-topbar-icon-btn" onClick={onOpenNotifications} aria-label="Notifications">
                    <Bell size={16} strokeWidth={1.75} />
                    {unreadNotificationCount > 0 && (
                        <span className="lab-topbar-badge">{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>
                    )}
                </button>
            </div>
        </header>
    );
}
