import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AudioLines, Lightbulb, Link2, SendHorizontal, Sparkles, X } from "lucide-react";
import type { KiwiMessage } from "../../lib/useKiwiChat";
import { STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./KiwiPanel.css";

const QUICK_ACTIONS = [
    "Summarize this project",
    "Suggest next steps",
    "Find related research",
    "Check risks & blockers",
];

type PanelTab = "chat" | "details" | "activity" | "files";

interface KiwiPanelProps {
    onClose: () => void;
    listening: boolean;
    transcript: string;
    setTranscript: (value: string) => void;
    messages: KiwiMessage[];
    supported: boolean;
    toggleListening: () => void;
    sendMessage: () => void;
    // Whichever project (if any) is currently open in the workspace
    // behind this panel — see Laboratory.tsx. When set, the panel gains
    // Details/Activity/Files tabs alongside Chat, so KIWI reads as
    // aware of what you're actually looking at rather than a floating,
    // context-free assistant.
    project?: LaboratoryProject | null;
}

/**
 * Laboratory's "Hey Kiwi" panel — a right-side sheet, not a full-screen
 * takeover, so closing it just continues wherever the workspace left
 * off (per explicit UX rule: "KIWI je stále součástí Laboratory, ale
 * není permanentně v cestě"). Shares its actual chat state/logic with
 * VoiceBar via useKiwiChat (lifted up into Laboratory.tsx so the same
 * `listening` value can also drive KiwiCoreBadge's reaction) — this
 * component only owns the side-panel presentation, the quick-action
 * shortcuts (which just prefill the input rather than doing anything
 * real yet — no AI wired up), and the Details/Activity/Files tabs.
 * Activity/Files are honest placeholders (same pattern as
 * ProjectWorkspace's own non-Overview modules) — there's no real
 * activity feed or file storage yet.
 */
export default function KiwiPanel({ onClose, listening, transcript, setTranscript, messages, supported, toggleListening, sendMessage, project }: KiwiPanelProps) {
    const [tab, setTab] = useState<PanelTab>("chat");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const conversationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = conversationRef.current;
        if (el && tab === "chat") el.scrollTop = el.scrollHeight;
    }, [messages, tab]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    const runQuickAction = (action: string) => {
        setTab("chat");
        setTranscript(action);
        textareaRef.current?.focus();
    };

    const status = project ? STATUS_META[project.status] : null;

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

                {project && (
                    <>
                        <div className="kiwi-panel-context">
                            <span className="kiwi-panel-context-label">Looking at</span>
                            <span className="kiwi-panel-context-name">{project.name}</span>
                        </div>
                        <nav className="kiwi-panel-tabs">
                            {(["chat", "details", "activity", "files"] as PanelTab[]).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    className={`kiwi-panel-tab${tab === t ? " kiwi-panel-tab-active" : ""}`}
                                    onClick={() => setTab(t)}
                                >
                                    {t[0].toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </nav>
                    </>
                )}

                <div className="kiwi-panel-body" ref={conversationRef}>
                    {tab === "chat" && (
                        messages.length === 0 ? (
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
                        )
                    )}

                    {tab === "details" && project && status && (
                        <div className="kiwi-panel-details">
                            <div className="kiwi-panel-detail-row">
                                <span className="kiwi-panel-detail-label">Status</span>
                                <span className="kiwi-panel-status" style={{ color: status.color, borderColor: status.color }}>{status.label}</span>
                            </div>
                            <div className="kiwi-panel-detail-row">
                                <span className="kiwi-panel-detail-label">Category</span>
                                <span>{project.category}</span>
                            </div>
                            <p className="kiwi-panel-detail-description">{project.description || "No description yet."}</p>

                            <div className="kiwi-panel-detail-row">
                                <span className="kiwi-panel-detail-label">Progress</span>
                                <span>{project.progress}%</span>
                            </div>

                            <div className="kiwi-panel-detail-section-title">Tags</div>
                            {project.tags.length > 0 ? (
                                <div className="kiwi-panel-tags">
                                    {project.tags.map((tag) => <span key={tag} className="kiwi-panel-tag">{tag}</span>)}
                                </div>
                            ) : (
                                <p className="kiwi-panel-detail-muted">No tags yet.</p>
                            )}

                            <div className="kiwi-panel-detail-section-title">Key dates</div>
                            <p className="kiwi-panel-detail-muted">Last activity: {project.lastActivity}. No other dates set yet.</p>

                            <div className="kiwi-panel-detail-section-title">Project links</div>
                            <p className="kiwi-panel-detail-muted">
                                <Link2 size={12} strokeWidth={2} style={{ verticalAlign: -1, marginRight: 4 }} />
                                No links added yet.
                            </p>
                        </div>
                    )}

                    {tab === "activity" && (
                        <div className="kiwi-panel-placeholder">
                            <span>Activity</span>
                            <p>A real activity feed isn't wired up yet — it's next in line.</p>
                        </div>
                    )}

                    {tab === "files" && (
                        <div className="kiwi-panel-placeholder">
                            <span>Files</span>
                            <p>File uploads aren't wired up yet — it's next in line.</p>
                        </div>
                    )}
                </div>

                {tab === "chat" && (
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
                )}
            </aside>
        </>
    );
}
