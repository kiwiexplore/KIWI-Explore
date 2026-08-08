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
        if (!name.trim() || !replyEmail.trim() || !message.trim()) {
            setError("Please fill in every field — we need your name and email to know who to reply to.");
            return;
        }
        setError(null);
        const subject = `KIWI Explore contact form — ${name.trim()}`;
        const bodyLines = [`Reply to: ${replyEmail.trim()}`, "", message.trim()];
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
                We ask for your name and email so we know who to reply to.
            </p>

            <div className="info-panel-field">
                <label htmlFor="contact-name">Name</label>
                <input id="contact-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="info-panel-field">
                <label htmlFor="contact-email">Your email</label>
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
                    <div className="info-panel-text">
                        <p>
                            KIWI Explore is a personal AI command center built
                            around a living 3D brain — one hub that pulls your
                            weather, news, calendar, finances, and everything
                            else you'd normally have scattered across a dozen
                            different apps into a single view, all orbiting
                            one place instead.
                        </p>
                        <p>
                            The brain isn't just decoration — it's meant to be
                            the actual hub that data flows through: every icon
                            around it represents a category (News, Calendar,
                            Finance, Health, and more), each one connected to
                            its own live widgets in the side columns. Talk to
                            it through <strong>Hey Kiwi</strong> using your
                            voice or just type, and it listens and responds
                            right there in the dashboard.
                        </p>
                        <p>
                            Everything is meant to be yours: from Profile
                            &amp; settings you can choose which icons and
                            widgets you actually want, reorder them like a
                            phone home screen, pick your own avatar, and set
                            the background to one of the built-in scenes or a
                            photo of your own. Subscription tiers (Standard,
                            Pro, Max) control how much of that you get access
                            to, with the top tier eventually unlocking the
                            Laboratory — a separate space for designing and
                            tracking physical projects.
                        </p>
                        <p>
                            It's still early. There's no real account system
                            or server behind it yet — that's the next big
                            piece being built — and new icons, widgets, and
                            capabilities are being added all the time. If
                            something's missing or broken, that's exactly what
                            the Contact us page below is for.
                        </p>
                    </div>
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

            <button type="button" className="info-panel-section info-panel-section-clickable" onClick={() => setPage("contact")}>
                <span className="info-panel-section-label">
                    <Mail size={16} strokeWidth={1.75} />
                    Contact us
                </span>
                <ChevronRight size={15} strokeWidth={2} className="info-panel-chevron" />
            </button>
        </div>
    );
}
