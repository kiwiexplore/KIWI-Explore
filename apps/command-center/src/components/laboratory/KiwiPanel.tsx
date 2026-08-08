import { useEffect, useRef, type KeyboardEvent } from "react";
import { AudioLines, Lightbulb, SendHorizontal, Sparkles, X } from "lucide-react";
import type { KiwiMessage } from "../../lib/useKiwiChat";
import "./KiwiPanel.css";

const QUICK_ACTIONS = [
    "Summarize this project",
    "Suggest next steps",
    "Find related research",
    "Check risks & blockers",
];

interface KiwiPanelProps {
    onClose: () => void;
    listening: boolean;
    transcript: string;
    setTranscript: (value: string) => void;
    messages: KiwiMessage[];
    supported: boolean;
    toggleListening: () => void;
    sendMessage: () => void;
}

/**
 * Laboratory's "Hey Kiwi" panel — a right-side sheet, not a full-screen
 * takeover, so closing it just continues wherever the workspace left
 * off (per explicit UX rule: "KIWI je stále součástí Laboratory, ale
 * není permanentně v cestě"). Shares its actual chat state/logic with
 * VoiceBar via useKiwiChat (lifted up into Laboratory.tsx so the same
 * `listening` value can also drive KiwiCoreBadge's reaction) — this
 * component only owns the side-panel presentation and the quick-action
 * shortcuts, which just prefill the input rather than doing anything
 * real yet (no AI wired up).
 */
export default function KiwiPanel({ onClose, listening, transcript, setTranscript, messages, supported, toggleListening, sendMessage }: KiwiPanelProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const conversationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = conversationRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    const runQuickAction = (action: string) => {
        setTranscript(action);
        textareaRef.current?.focus();
    };

    return (
        <>
            <div className="kiwi-panel-scrim" onClick={onClose} />
            <aside className="kiwi-panel">
                <header className="kiwi-panel-header">
                    <span className="kiwi-panel-title">
                        <Sparkles size={16} strokeWidth={1.75} />
                        KIWI
                    </span>
                    <button type="button" className="kiwi-panel-close" onClick={onClose} aria-label="Close">
                        <X size={16} strokeWidth={1.75} />
                    </button>
                </header>

                <div className="kiwi-panel-body" ref={conversationRef}>
                    {messages.length === 0 ? (
                        <>
                            <p className="kiwi-panel-greeting">
                                Hey! I'm not connected to anything real yet, but here's what this panel
                                is going to do once I am.
                            </p>
                            <div className="kiwi-panel-actions">
                                {QUICK_ACTIONS.map((action) => (
                                    <button key={action} type="button" className="kiwi-panel-action" onClick={() => runQuickAction(action)}>
                                        <Lightbulb size={14} strokeWidth={1.75} />
                                        {action}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="kiwi-panel-messages">
                            {messages.map((m) => (
                                <div key={m.id} className="kiwi-panel-message">{m.text}</div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="kiwi-panel-input-row">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        className="kiwi-panel-input"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask KIWI anything..."
                        disabled={listening}
                    />
                    <button
                        type="button"
                        className={`kiwi-panel-mic${listening ? " kiwi-panel-mic-active" : ""}`}
                        onClick={toggleListening}
                        disabled={!supported}
                        aria-label={supported ? "Voice input" : "Voice input isn't supported in this browser"}
                        aria-pressed={listening}
                    >
                        <AudioLines size={16} strokeWidth={1.75} />
                    </button>
                    <button
                        type="button"
                        className="kiwi-panel-send"
                        onClick={sendMessage}
                        disabled={!transcript.trim()}
                        aria-label="Send"
                    >
                        <SendHorizontal size={16} strokeWidth={1.75} />
                    </button>
                </div>
            </aside>
        </>
    );
}
