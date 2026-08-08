import { useState, type FormEvent } from "react";
import {
    ArrowLeft, Bell, ChevronRight, FileText, Mail, Info as InfoIcon, ShieldCheck,
} from "lucide-react";
import "./InfoPanel.css";

const CONTACT_EMAIL = "kiwiexplore.project@gmail.com";

type Page = "menu" | "about" | "contact" | "terms" | "privacy" | "updates";

function ContactForm() {
    const [name, setName] = useState("");
    const [replyEmail, setReplyEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!message.trim()) {
            setError("Please write a message first.");
            return;
        }
        setError(null);
        const subject = `KIWI Explore contact form${name.trim() ? ` — ${name.trim()}` : ""}`;
        const bodyLines = [replyEmail.trim() ? `Reply to: ${replyEmail.trim()}` : null, "", message.trim()].filter((l) => l !== null);
        const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
        window.location.href = mailto;
        setSent(true);
    };

    if (sent) {
        return (
            <div className="info-panel-text">
                Your email app should have opened with your message ready to
                go — just hit send there. If nothing opened, you can reach us
                directly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </div>
        );
    }

    return (
        <form className="info-panel-form" onSubmit={handleSubmit}>
            <p className="info-panel-text">
                Questions, bug reports, ideas — send us a message and it'll
                open in your own email app, addressed to <strong>{CONTACT_EMAIL}</strong>.
            </p>

            <div className="info-panel-field">
                <label htmlFor="contact-name">Name (optional)</label>
                <input id="contact-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="info-panel-field">
                <label htmlFor="contact-email">Your email (optional, so we can reply)</label>
                <input id="contact-email" type="email" value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)} />
            </div>

            <div className="info-panel-field">
                <label htmlFor="contact-message">Message</label>
                <textarea id="contact-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            {error && <div className="info-panel-error">{error}</div>}

            <button type="submit" className="info-panel-submit">Send</button>
        </form>
    );
}

/**
 * "About / Info" panel — opened from TopBar's Info icon. Menu → sub-page
 * navigation, same pattern as ProfileSettings. Terms/Privacy/Updates
 * stay placeholders on purpose (no real legal text or changelog exists
 * yet) — About and Contact are the two that are actually real: About
 * has genuine project copy, Contact opens a pre-filled mailto (no
 * backend to send through yet, but this doesn't need one to work).
 */
export default function InfoPanel() {
    const [page, setPage] = useState<Page>("menu");

    if (page !== "menu") {
        const titles: Record<Exclude<Page, "menu">, string> = {
            about: "About this project",
            contact: "Contact us",
            terms: "Terms & conditions",
            privacy: "Privacy policy",
            updates: "Updates",
        };
        return (
            <div className="info-panel">
                <button type="button" className="info-panel-back" onClick={() => setPage("menu")}>
                    <ArrowLeft size={14} strokeWidth={2} />
                    {titles[page]}
                </button>

                {page === "about" && (
                    <p className="info-panel-text">
                        KIWI Explore is a personal AI command center built
                        around a living 3D brain — one hub that pulls your
                        weather, news, calendar, and other everyday tools
                        into a single view instead of scattering them across
                        a dozen apps. Talk to it through Hey Kiwi, rearrange
                        it exactly how you like from Profile &amp; settings,
                        and watch it grow as more of your world connects to
                        it.
                        <br /><br />
                        It's still early — new icons, widgets, and
                        capabilities are being added all the time.
                    </p>
                )}

                {page === "contact" && <ContactForm />}

                {page === "terms" && (
                    <p className="info-panel-text">
                        Terms &amp; conditions haven't been written yet —
                        KIWI Explore is still in early, personal development
                        and hasn't opened up to the public. This page will
                        hold the real terms once that happens.
                    </p>
                )}

                {page === "privacy" && (
                    <p className="info-panel-text">
                        There's no backend yet, so there's nothing to leak:
                        your nickname, avatar, background, and layout
                        choices live only in your browser for this session
                        and disappear the moment you reload. Once accounts
                        and a real server exist, this page will explain
                        exactly what's stored, why, and how it's protected.
                    </p>
                )}

                {page === "updates" && (
                    <p className="info-panel-text">No updates yet — check back soon.</p>
                )}
            </div>
        );
    }

    return (
        <div className="info-panel">
            <button type="button" className="info-panel-section info-panel-section-clickable" onClick={() => setPage("about")}>
                <span className="info-panel-section-label">
                    <InfoIcon size={16} strokeWidth={1.75} />
                    About this project
                </span>
                <ChevronRight size={15} strokeWidth={2} className="info-panel-chevron" />
            </button>

            <button type="button" className="info-panel-section info-panel-section-clickable" onClick={() => setPage("contact")}>
                <span className="info-panel-section-label">
                    <Mail size={16} strokeWidth={1.75} />
                    Contact us
                </span>
                <ChevronRight size={15} strokeWidth={2} className="info-panel-chevron" />
            </button>

            <button type="button" className="info-panel-section info-panel-section-clickable" onClick={() => setPage("terms")}>
                <span className="info-panel-section-label">
                    <FileText size={16} strokeWidth={1.75} />
                    Terms &amp; conditions
                </span>
                <ChevronRight size={15} strokeWidth={2} className="info-panel-chevron" />
            </button>

            <button type="button" className="info-panel-section info-panel-section-clickable" onClick={() => setPage("privacy")}>
                <span className="info-panel-section-label">
                    <ShieldCheck size={16} strokeWidth={1.75} />
                    Privacy policy
                </span>
                <ChevronRight size={15} strokeWidth={2} className="info-panel-chevron" />
            </button>

            <button type="button" className="info-panel-section info-panel-section-clickable" onClick={() => setPage("updates")}>
                <span className="info-panel-section-label">
                    <Bell size={16} strokeWidth={1.75} />
                    Updates
                </span>
                <ChevronRight size={15} strokeWidth={2} className="info-panel-chevron" />
            </button>
        </div>
    );
}
