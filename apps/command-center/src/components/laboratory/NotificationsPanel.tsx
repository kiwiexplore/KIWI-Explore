import { Bell, Check, X } from "lucide-react";
import type { LabNotification } from "../../state/notifications";
import "./NotificationsPanel.css";

interface NotificationsPanelProps {
    onClose: () => void;
    notifications: LabNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onRemove: (id: string) => void;
}

/**
 * Laboratory's notification feed — same dropdown pattern as
 * LaboratorySearch (fixed near the top-right, invisible scrim to
 * close on outside click). Clicking a notification marks it read;
 * there's no real background process producing these yet (see
 * state/notifications.ts), just seeded examples so the bell icon in
 * LaboratoryTopBar has something real to open.
 */
export default function NotificationsPanel({ onClose, notifications, onMarkRead, onMarkAllRead, onRemove }: NotificationsPanelProps) {
    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <>
            <div className="lab-notif-scrim" onClick={onClose} />
            <div className="lab-notif-panel">
                <div className="lab-notif-header">
                    <span className="lab-notif-title">
                        <Bell size={14} strokeWidth={1.75} />
                        Notifications
                    </span>
                    {unreadCount > 0 && (
                        <button type="button" className="lab-notif-mark-all" onClick={onMarkAllRead}>
                            <Check size={12} strokeWidth={2} />
                            Mark all read
                        </button>
                    )}
                </div>

                {notifications.length === 0 ? (
                    <div className="lab-notif-empty">Nothing yet — you're all caught up.</div>
                ) : (
                    <div className="lab-notif-list">
                        {notifications.map((n) => (
                            <div key={n.id} className={`lab-notif-item${n.read ? "" : " lab-notif-item-unread"}`}>
                                <button type="button" className="lab-notif-item-main" onClick={() => onMarkRead(n.id)}>
                                    {!n.read && <span className="lab-notif-dot" />}
                                    <span className="lab-notif-main-text">
                                        <span className="lab-notif-item-title">{n.title}</span>
                                        <span className="lab-notif-item-detail">{n.detail}</span>
                                        <span className="lab-notif-item-time">{n.createdAt}</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="lab-notif-remove"
                                    aria-label="Dismiss notification"
                                    onClick={() => onRemove(n.id)}
                                >
                                    <X size={12} strokeWidth={2} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
