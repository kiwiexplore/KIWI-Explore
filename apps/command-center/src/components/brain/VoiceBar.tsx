import { useState } from "react";
import { AudioLines, Search } from "lucide-react";
import "./VoiceBar.css";

/**
 * Placeholder for the planned voice command bar ("Hey Kiwi") — visual
 * only for now, no actual speech recognition wired up yet. Lives in the
 * center of TopBar, above the brain, rather than in the CommandBar's
 * usual spot, since this scene is still the isolated 3D test harness,
 * not the real KIWI HQ layout.
 *
 * Search icon + label sit at the left edge of the pill; the voice-input
 * button sits at the far right. Since real speech input doesn't exist
 * yet, clicking the voice button toggles a mock "listening" state so its
 * waveform icon visibly animates — standing in for what would otherwise
 * only animate while actually hearing the user talk.
 */
export default function VoiceBar() {
    const [listening, setListening] = useState(false);

    return (
        <div className="voice-bar">
            <div className="voice-bar-left">
                <Search size={18} color="#8fd6ff" strokeWidth={1.75} />
                <span>Hey Kiwi...</span>
            </div>
            <button
                type="button"
                className={`voice-bar-mic${listening ? " voice-bar-mic-active" : ""}`}
                onClick={() => setListening((v) => !v)}
                aria-label="Voice input"
                aria-pressed={listening}
            >
                <AudioLines size={18} strokeWidth={1.75} />
            </button>
        </div>
    );
}
