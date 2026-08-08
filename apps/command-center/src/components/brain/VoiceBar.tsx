import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AudioLines, ChevronDown, Search, SendHorizontal } from "lucide-react";
import { useKiwiChat } from "../../lib/useKiwiChat";
import "./VoiceBar.css";

// Caps the textarea's own auto-grow (see the input effect below) — past
// this it scrolls internally instead of pushing the row (and the canvas
// above it) any taller.
const MAX_TEXTAREA_HEIGHT = 72;

/**
 * Real browser speech-to-TEXT (Web Speech API) — no backend, no API key.
 * Click the mic to start listening; what you say replaces the "Hey
 * Kiwi..." placeholder live as you speak. Not every browser supports it
 * (Firefox notably doesn't) — the mic button is simply disabled there
 * rather than pretending to work. Also a real text input — typing works
 * too, sharing the same `transcript` state speech fills in. Disabled
 * while actively listening so the two input methods can't fight over
 * the same field. The actual chat state/logic lives in useKiwiChat
 * (shared with Laboratory's KiwiPanel) — this component is just its
 * floating-bar-below-the-brain presentation.
 *
 * Focusing the input (or starting to listen, or sending a message)
 * expands the bar into a taller card: a conversation area floats
 * ABOVE the input row (absolutely positioned, so it grows into the
 * canvas's own empty space above rather than pushing the brain around
 * or reflowing the page), and the input itself grows a couple of lines
 * tall so there's actual room to write instead of a cramped single
 * line. The conversation area scrolls internally past a height cap —
 * there just isn't room to always show everything given where this
 * sits. There's still no AI behind this — sent messages appear as your
 * own bubbles, with a plain note where Kiwi's replies will show up
 * once that's wired up, rather than faking a response.
 */
interface VoiceBarProps {
    // Fired whenever `listening` changes — lets BrainScene3D pause the
    // brain's idle rotation and boost its glow while Hey Kiwi is
    // actively listening, then return to normal the moment it stops.
    onListeningChange?: (listening: boolean) => void;
}

export default function VoiceBar({ onListeningChange }: VoiceBarProps) {
    const { listening, transcript, setTranscript, messages, supported, toggleListening, sendMessage } = useKiwiChat(onListeningChange);
    const [expanded, setExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const conversationRef = useRef<HTMLDivElement>(null);

    // Auto-grows the textarea with its content, up to MAX_TEXTAREA_HEIGHT,
    // then leaves it to scroll internally.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    }, [transcript]);

    // Keeps the newest message in view as the conversation grows.
    useEffect(() => {
        const el = conversationRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    const handleToggleListening = () => {
        toggleListening();
        if (!listening) setExpanded(true);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className={`voice-bar-wrap${expanded ? " voice-bar-wrap-expanded" : ""}`}>
            {expanded && (
                <div className="voice-bar-panel">
                    <button type="button" className="voice-bar-collapse" onClick={() => setExpanded(false)} aria-label="Collapse">
                        <ChevronDown size={14} strokeWidth={2} />
                    </button>
                    <div className="voice-bar-conversation" ref={conversationRef}>
                        {messages.length === 0 ? (
                            <div className="voice-bar-placeholder">
                                Kiwi will reply here once it's connected — for now this just captures what you say or type.
                            </div>
                        ) : (
                            messages.map((m) => (
                                <div key={m.id} className="voice-bar-message">{m.text}</div>
                            ))
                        )}
                    </div>
                </div>
            )}

            <div className="voice-bar">
                <div className="voice-bar-left">
                    <Search size={18} color="#8fd6ff" strokeWidth={1.75} />
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        className="voice-bar-text"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setExpanded(true)}
                        placeholder="Hey Kiwi..."
                        disabled={listening}
                        aria-label="Message Kiwi"
                    />
                </div>
                <button
                    type="button"
                    className="voice-bar-send"
                    onClick={sendMessage}
                    disabled={!transcript.trim()}
                    aria-label="Send"
                >
                    <SendHorizontal size={16} strokeWidth={1.75} />
                </button>
                <button
                    type="button"
                    className={`voice-bar-mic${listening ? " voice-bar-mic-active" : ""}`}
                    onClick={handleToggleListening}
                    disabled={!supported}
                    aria-label={supported ? "Voice input" : "Voice input isn't supported in this browser"}
                    aria-pressed={listening}
                >
                    <AudioLines size={18} strokeWidth={1.75} />
                </button>
            </div>
        </div>
    );
}
