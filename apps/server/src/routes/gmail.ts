import { Router } from "express";
import { getValidGoogleAccessToken, GoogleNotConnectedError, GoogleNotConfiguredError } from "../google.js";

export const gmailRouter = Router();

export interface GmailMessage {
    id: string;
    subject: string;
    from: string;
    snippet: string;
    // Gmail's own web URL for this exact message — the point of
    // showing these at all (see the Communication orbit icon): open
    // the real thing, don't just display a read-only copy of it.
    link: string;
}

interface RawMessageList {
    messages?: { id: string }[];
    resultSizeEstimate?: number;
}

interface RawMessageDetail {
    id: string;
    snippet?: string;
    payload?: { headers?: { name: string; value: string }[] };
}

function headerValue(detail: RawMessageDetail, name: string): string {
    return detail.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function fetchMessageDetail(accessToken: string, id: string): Promise<GmailMessage> {
    const params = new URLSearchParams({ format: "metadata" });
    params.append("metadataHeaders", "From");
    params.append("metadataHeaders", "Subject");
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Gmail API request failed: ${res.status}`);
    const detail = (await res.json()) as RawMessageDetail;
    return {
        id: detail.id,
        subject: headerValue(detail, "Subject") || "(no subject)",
        from: headerValue(detail, "From"),
        snippet: detail.snippet ?? "",
        link: `https://mail.google.com/mail/u/0/#inbox/${detail.id}`,
    };
}

gmailRouter.get("/messages", async (_req, res) => {
    try {
        const accessToken = await getValidGoogleAccessToken();
        const params = new URLSearchParams({ maxResults: "5", labelIds: "INBOX", q: "is:unread" });
        const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!listRes.ok) {
            const body = await listRes.text().catch(() => "");
            throw new Error(`Gmail API request failed: ${listRes.status} ${body}`.trim());
        }
        const list = (await listRes.json()) as RawMessageList;
        const ids = (list.messages ?? []).map((m) => m.id);
        const messages = await Promise.all(ids.map((id) => fetchMessageDetail(accessToken, id)));
        res.json({ messages, unreadCount: list.resultSizeEstimate ?? messages.length });
    } catch (e) {
        if (e instanceof GoogleNotConnectedError) {
            res.status(404).json({ error: e.message });
            return;
        }
        if (e instanceof GoogleNotConfiguredError) {
            res.status(503).json({ error: e.message });
            return;
        }
        console.error("Fetching Gmail messages failed:", e);
        res.status(502).json({ error: e instanceof Error ? e.message : "Could not reach Gmail." });
    }
});
