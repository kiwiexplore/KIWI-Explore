import { useState } from "react";
import { ChevronDown, ExternalLink, Video } from "lucide-react";
import "./LiberecCamera.css";

/**
 * The Liberec Region's roof camera, live in the corner of the brain.
 *
 * The stream is the Regional Office's own public YouTube broadcast —
 * "Panorama KU Liberec" — which is what kraj-lbc.cz/urad/online-kamera
 * embeds. It is read straight from YouTube rather than through the feed
 * service, because unlike Drbna and Deník this one is a player, not a
 * fetch: nothing has to be parsed and CORS never comes into it.
 *
 * The iframe is mounted only while the panel is open. A live 1080p
 * stream decoding behind a collapsed panel would cost a laptop real
 * battery for a picture nobody is looking at, so collapsing it doesn't
 * hide the video — it unloads it.
 *
 * Muted, because every browser refuses to autoplay a stream with sound.
 * The control to unmute is YouTube's own, inside the player.
 */

/** From the page's own embed. Kept here rather than in .env: it is not
 *  a secret, it is not per-install, and a constant is easier to find. */
const VIDEO_ID = "NY4L8R8c40w";
const SOURCE = "https://www.kraj-lbc.cz/urad/online-kamera";

const STORAGE_KEY = "kiwi.camera.liberec";

export default function LiberecCamera() {
    // Remembered, because whether you want a live picture in the corner
    // is a standing preference rather than a per-visit decision.
    const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== "closed");

    const toggle = () => setOpen((was) => {
        localStorage.setItem(STORAGE_KEY, was ? "closed" : "open");
        return !was;
    });

    return (
        <aside className={`libcam${open ? "" : " libcam-closed"}`}>
            <div className="libcam-head">
                <span className="libcam-live" aria-hidden="true" />
                <span className="libcam-title">Liberec — live</span>
                <a
                    className="libcam-source"
                    href={SOURCE}
                    target="_blank"
                    rel="noreferrer"
                    title="Krajský úřad Libereckého kraje"
                    aria-label="Open the source page"
                >
                    <ExternalLink size={12} strokeWidth={2} />
                </a>
                <button
                    type="button"
                    className="libcam-toggle"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label={open ? "Hide the camera" : "Show the camera"}
                >
                    {open ? <ChevronDown size={14} strokeWidth={2} /> : <Video size={14} strokeWidth={2} />}
                </button>
            </div>

            {open && (
                <div className="libcam-frame">
                    <iframe
                        // `origin` is not optional in practice: without it
                        // YouTube answers an embed with error 153 rather
                        // than a picture.
                        src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`}
                        title="Panorama KÚ Liberec"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                </div>
            )}
        </aside>
    );
}
