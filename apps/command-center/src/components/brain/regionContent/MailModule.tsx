import { useAsyncData } from "./useAsyncData";
import { fetchInbox } from "../../../lib/mail";
import type { ModuleViewProps } from "./types";

/**
 * What's in the inbox, without opening the inbox.
 *
 * A list of senders and subjects, newest first, unread marked — enough
 * to know whether anything needs you. Deliberately not a mail client:
 * there is no reading, no replying and no deleting here, and the
 * service behind it opens the mailbox read-only so that using this
 * cannot change what's in it.
 *
 * Needs credentials in the feed service's .env, which is why it says so
 * plainly when it has none rather than showing an empty list that looks
 * like an empty inbox — those are very different things.
 */
export function CommunicationModule({ mode }: ModuleViewProps) {
    const { data, error, loading } = useAsyncData("mail", fetchInbox);

    if (loading) return <span className="module-muted">{mode === "summary" ? "…" : "Opening the mailbox…"}</span>;

    if (error || !data) {
        return (
            <span className="module-muted">
                {mode === "summary" ? "unavailable" : "KIWI's feed service isn't answering, so the mailbox can't be read."}
            </span>
        );
    }

    if (!data.configured) {
        if (mode === "summary") return <>Not connected</>;
        return (
            <div className="module-detail">
                <p className="module-note">
                    The inbox is read over IMAP by KIWI's own feed service —
                    a browser can't do it, and a mail token must never live
                    in a page. Add <code>MAIL_HOST</code>, <code>MAIL_USER</code> and
                    {" "}<code>MAIL_PASSWORD</code> to <code>apps/feed-service/.env</code>.
                </p>
                <p className="module-note">
                    Use an <strong>app password</strong>, never your account
                    password: it's scoped to one program and you can revoke
                    it on its own. Gmail issues them under Security → App
                    passwords; Seznam and most others have the same thing.
                </p>
                <p className="module-note">
                    KIWI reads headers only — sender, subject, date, read or
                    unread. The mailbox is opened read-only, so nothing is
                    marked, moved or sent.
                </p>
            </div>
        );
    }

    if (data.error) {
        if (mode === "summary") return <span className="module-muted">mailbox refused</span>;
        return (
            <div className="module-detail">
                <p className="module-note">The mail server refused: {data.error}</p>
                <p className="module-note">
                    Usually the password (it must be an app password, not the
                    account's own) or IMAP being switched off in the
                    provider's settings.
                </p>
            </div>
        );
    }

    if (mode === "summary") {
        if (data.messages.length === 0) return <>Inbox empty</>;
        return data.unread > 0
            ? <>{data.unread} unread · {data.messages[0].from}</>
            : <>Nothing unread · {data.messages[0].from}</>;
    }

    return (
        <div className="module-detail">
            <div className="module-headline">
                <span className="module-headline-figure">{data.unread}</span>
                <span className="module-headline-note">
                    unread of the last {data.messages.length} in {data.mailbox ?? "INBOX"}
                </span>
            </div>

            <ul className="module-list">
                {data.messages.map((message) => (
                    <li key={message.id} className={`module-mail${message.unread ? " module-mail-unread" : ""}`}>
                        <span className="module-mail-from">{message.from}</span>
                        <span className="module-mail-when">
                            {new Date(message.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        <span className="module-mail-subject">{message.subject}</span>
                    </li>
                ))}
            </ul>

            <p className="module-note">
                Headers only, read-only — opening this changes nothing in
                the mailbox.
            </p>
        </div>
    );
}
