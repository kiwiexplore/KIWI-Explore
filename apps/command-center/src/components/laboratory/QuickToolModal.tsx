import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import "./QuickToolModal.css";

interface QuickToolModalProps {
    title: string;
    icon: LucideIcon;
    onClose: () => void;
    headerExtra?: ReactNode;
    children: ReactNode;
    // Widens the card from 560px to 720px — for content that needs
    // real horizontal room (a calendar grid) rather than a list/canvas.
    wide?: boolean;
}

/**
 * Shared centered-modal chrome (scrim + card + header/close) for the
 * Quick Bar's canvas-style tools (Mind Map, Whiteboard) — a different
 * shape from CalendarPanel/NotificationsPanel's right-side sheet since
 * these need real width for a diagram/canvas rather than a list.
 */
export default function QuickToolModal({ title, icon: Icon, onClose, headerExtra, children, wide }: QuickToolModalProps) {
    return (
        <>
            <div className="quick-tool-scrim" onClick={onClose} />
            <div className={`quick-tool-modal${wide ? " quick-tool-modal-wide" : ""}`}>
                <header className="quick-tool-modal-header">
                    <span className="quick-tool-modal-title">
                        <Icon size={16} strokeWidth={1.75} />
                        {title}
                    </span>
                    {headerExtra}
                    <button type="button" className="quick-tool-modal-close" onClick={onClose} aria-label="Close">
                        <X size={16} strokeWidth={1.75} />
                    </button>
                </header>
                <div className="quick-tool-modal-body">
                    {children}
                </div>
            </div>
        </>
    );
}
