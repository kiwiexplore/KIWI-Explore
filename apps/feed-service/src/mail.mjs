import { ImapFlow } from "imapflow";

/**
 * A glance at the inbox.
 *
 * Mail is the one thing on KIWI's roadmap that a browser genuinely
 * cannot do: there is no mailbox API a page may talk to, and the ones
 * that exist (Gmail, Graph) hand out tokens that a page must never
 * hold. So it happens here, on the server, over IMAP — which every
 * provider still speaks and which needs no OAuth application, no
 * consent screen and no review.
 *
 * WHAT IT READS AND WHAT IT DOESN'T: headers only — who it's from, the
 * subject, when it arrived, whether it's been read. No bodies, no
 * attachments, nothing is marked as read, nothing is moved, and nothing
 * is sent. It opens the mailbox read-only and says so to the server.
 *
 * CREDENTIALS: from this service's own .env, which the person running
 * it writes. Use an APP PASSWORD, never the account's real one —
 * Gmail, Seznam and the rest all issue them, they're scoped to one
 * program, and they can be revoked on their own. The file is
 * gitignored; nothing here logs it or sends it anywhere but the mail
 * server it belongs to.
 */

const HOST = process.env.MAIL_HOST;
const USER = process.env.MAIL_USER;
const PASSWORD = process.env.MAIL_PASSWORD;
const PORT = Number(process.env.MAIL_PORT ?? 993);
const MAILBOX = process.env.MAIL_MAILBOX ?? "INBOX";

// How many of the newest messages to describe.
const LIMIT = 12;

export function mailConfigured() {
    return Boolean(HOST && USER && PASSWORD);
}

function describe(message) {
    const from = message.envelope?.from?.[0];
    return {
        id: String(message.uid),
        from: from?.name || from?.address || "Unknown sender",
        address: from?.address ?? "",
        subject: message.envelope?.subject || "(no subject)",
        date: (message.envelope?.date ?? new Date()).toISOString(),
        // \\Seen is the flag every IMAP server uses for "opened".
        unread: !message.flags?.has("\\Seen"),
    };
}

export async function inbox() {
    if (!mailConfigured()) {
        return { configured: false, messages: [], unread: 0 };
    }

    const client = new ImapFlow({
        host: HOST,
        port: PORT,
        secure: true,
        auth: { user: USER, pass: PASSWORD },
        // The library logs every command at info level by default,
        // which puts envelopes in the terminal.
        logger: false,
    });

    await client.connect();
    try {
        // readOnly, explicitly: opening a mailbox for writing is what
        // marks messages as read as a side effect.
        const lock = await client.getMailboxLock(MAILBOX, { readOnly: true });
        try {
            const total = client.mailbox.exists;
            if (total === 0) return { configured: true, messages: [], unread: 0 };

            const from = Math.max(1, total - LIMIT + 1);
            const messages = [];
            for await (const message of client.fetch(`${from}:${total}`, { envelope: true, flags: true })) {
                messages.push(describe(message));
            }

            messages.reverse();
            return {
                configured: true,
                messages,
                unread: messages.filter((message) => message.unread).length,
                mailbox: MAILBOX,
            };
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}
