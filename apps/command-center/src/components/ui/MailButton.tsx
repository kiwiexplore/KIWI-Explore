import { useState } from "react";
import { Mail } from "lucide-react";
import { useAsyncData } from "../brain/regionContent/useAsyncData";
import { fetchInbox } from "../../lib/mail";
import "./MailButton.css";

interface MailButtonProps {
    /** The host bar's own icon-button class, so it looks native to it. */
    className: string;
    /** The host bar's own badge class. */
    badgeClassName: string;
    /**
     * Where the full list lives, when there is somewhere to go. The
     * dashboard opens the Communication module in the brain; the
     * Laboratory has no such place, so it leaves this out and the drop
     * is the whole feature there.
     */
    onOpenFull?: () => void;
}

/**
 * The inbox, as an icon in a top bar.
 *
 * The same button in both bars (per explicit request) — the dashboard's
 * and the Laboratory's — over one shared fetch, so the count never
 * disagrees between them. It sits with the calendar and the bell
 * because it belongs to the same family: things that arrive whether or
 * not you asked.
 *
 * The badge is the unread count. The drop is who wrote and about what,
 * newest first — enough to decide whether to go and read it, which is
 * the whole job here. What is and isn't read from the mailbox is in
 * lib/mail.ts; nothing in this component can change a message.
 */
export default function MailButton({ className, badgeClassName, onOpenFull }: MailButtonProps) {
    const { data, error, loading } = useAsyncData("mail", fetchInbox);
    const [open, setOpen] = useState(false);

    const messages = data?.messages ?? [];
    const unread = data?.unread ?? 0;

    let state: string;
    if (loading) state = "Opening the mailbox…";
    else if (error) state = "KIWI's feed service isn't answering.";
    else if (!data?.configured) state = "Not connected — add MAIL_HOST, MAIL_USER and MAIL_PASSWORD to apps/feed-service/.env, using an app password.";
    else if (data.error) state = `The mail server refused: ${data.error}`;
    else if (messages.length === 0) state = "The inbox is empty.";
    else state = unread > 0 ? `${unread} unread` : "Nothing unread";

    return (
        <div className="mail-button-shell">
            <button
                type="button"
                className={className}
                aria-label="Inbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                <Mail size={17} strokeWidth={1.75} />
                {unread > 0 && (
                    <span className={badgeClassName}>{unread > 9 ? "9+" : unread}</span>
                )}
            </button>

            {open && (
                <>
                    <div className="mail-button-scrim" onClick={() => setOpen(false)} />
                    <div className="mail-button-drop">
                        <div className="mail-button-head">
                            <span className="mail-button-title">Inbox</span>
                            <span className="mail-button-state">{state}</span>
                        </div>

                        {messages.length > 0 && (
                            <ul className="mail-button-list">
                                {messages.slice(0, 8).map((message) => (
                                    <li
                                        key={message.id}
                                        className={`mail-button-item${message.unread ? " mail-button-item-unread" : ""}`}
                                    >
                                        <span className="mail-button-from">{message.from}</span>
                                        <span className="mail-button-when">
                                            {new Date(message.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                        </span>
                                        <span className="mail-button-subject">{message.subject}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {onOpenFull && (
                            <button
                                type="button"
                                className="mail-button-more"
                                onClick={() => { setOpen(false); onOpenFull(); }}
                            >
                                Open the inbox in the brain
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
