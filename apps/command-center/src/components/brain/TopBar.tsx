import { Orbit, UserCircle2 } from "lucide-react";
import VoiceBar from "./VoiceBar";
import "./TopBar.css";

/**
 * Header row above the brain scene — brand mark (left), the "Hey Kiwi"
 * voice bar (center), and a login/system-status placeholder (right).
 * The login/status panel is structural only for now (no real auth or
 * live status wired up yet) — it exists so the layout is already in
 * place for when that's built.
 */
export default function TopBar() {
    return (
        <header className="top-bar">
            <div className="top-bar-brand">
                <Orbit size={24} color="#49C7FF" strokeWidth={1.5} />
                <span className="top-bar-brand-text">
                    KIWI <span className="top-bar-brand-accent">AI Operation System</span>
                </span>
            </div>

            <div className="top-bar-center">
                <VoiceBar />
            </div>

            <div className="top-bar-status">
                <span className="top-bar-status-dot" />
                <span className="top-bar-status-text">System Online</span>
                <span className="top-bar-status-divider" />
                <button type="button" className="top-bar-signin">
                    <UserCircle2 size={18} strokeWidth={1.75} />
                    Sign in
                </button>
            </div>
        </header>
    );
}
