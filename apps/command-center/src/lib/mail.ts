/**
 * A glance at the inbox, by way of KIWI's own service.
 *
 * This is the one thing on the roadmap a page cannot do for itself at
 * all. There is no mailbox API a browser may call, and the ones that
 * exist hand out tokens that must never live in a page — so the mailbox
 * is read on the server, over IMAP, from credentials that stay in its
 * .env (see apps/feed-service/src/mail.mjs).
 *
 * Headers only: who, what, when, read or not. No bodies, and nothing is
 * marked, moved or sent.
 */

export interface MailMessage {
    id: string;
    from: string;
    address: string;
    subject: string;
    date: string;
    unread: boolean;
}

export interface Inbox {
    /** False when the service has no mail credentials set. */
    configured: boolean;
    messages: MailMessage[];
    unread: number;
    mailbox?: string;
    /** Set when the mail server refused — wrong password, IMAP off. */
    error?: string;
}

const SERVICE_URL = `${import.meta.env.VITE_FEED_SERVICE ?? ""}/api/mail`;

export async function fetchInbox(): Promise<Inbox> {
    const res = await fetch(SERVICE_URL);
    if (!res.ok) throw new Error(`feed service responded ${res.status}`);
    return await res.json() as Inbox;
}
