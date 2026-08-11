import { useState } from "react";

/**
 * Laboratory's notification feed — where anything that happens without
 * you watching it (KIWI finishing a background task, a prototype
 * advancing stage, etc.) shows up. Mock/in-memory only, same as
 * everything else here: there's no real background AI producing these
 * yet, just seeded example entries so the bell icon has something
 * real to show.
 */
export interface LabNotification {
    id: string;
    title: string;
    detail: string;
    createdAt: string; // human-readable, mock — no real timestamps yet
    read: boolean;
}

export const MOCK_NOTIFICATIONS: LabNotification[] = [
    { id: "notif-1", title: "KIWI finished summarizing Debut EP", detail: "3 open risks flagged from the project notes.", createdAt: "10 min ago", read: false },
    { id: "notif-2", title: "Materials Study prototype moved to Testing", detail: "Stage advanced automatically after your last update.", createdAt: "2 hours ago", read: false },
    { id: "notif-3", title: "Weekly research digest ready", detail: "2 new findings saved to KIWI AI OS.", createdAt: "Yesterday", read: true },
];

export interface NotificationsState {
    notifications: LabNotification[];
    unreadCount: number;
    markRead: (id: string) => void;
    markAllRead: () => void;
    removeNotification: (id: string) => void;
}

export function useNotificationsState(): NotificationsState {
    const [notifications, setNotifications] = useState<LabNotification[]>(MOCK_NOTIFICATIONS);

    const markRead = (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    const removeNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
        markRead,
        markAllRead,
        removeNotification,
    };
}
