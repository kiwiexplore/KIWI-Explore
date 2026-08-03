import { Mic } from "lucide-react";
import "./VoiceBar.css";

/**
 * Placeholder for the planned voice command bar ("Hey Kiwi") — visual
 * only for now, no actual speech recognition wired up yet. Lives in the
 * center of TopBar, above the brain, rather than in the CommandBar's
 * usual spot, since this scene is still the isolated 3D test harness,
 * not the real KIWI HQ layout.
 */
export default function VoiceBar() {
    return (
        <div className="voice-bar">
            <Mic size={18} color="#8fd6ff" strokeWidth={1.75} />
            <span>Hey Kiwi...</span>
        </div>
    );
}
