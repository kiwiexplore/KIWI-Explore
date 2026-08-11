import { useEffect, useRef, useState } from "react";
import {
    ChevronLeft, FileBarChart, ImagePlus, Lightbulb, Network, Pause, PenTool, Play, Square, Telescope,
    type LucideIcon,
} from "lucide-react";
import type { LaboratorySection } from "./Laboratory";
import "./LaboratoryQuickBar.css";

// "mindmap"/"whiteboard" open their own modal (see below); "section"
// tools just jump the main view to an already-real Laboratory section
// — Ideation -> Ideas, AI Research -> Market Analysis, Image Gen ->
// Image Generation, Reports -> Analytics. No more placeholders here;
// every quick tool does something real now.
type QuickToolAction =
    | { kind: "mindmap" }
    | { kind: "whiteboard" }
    | { kind: "section"; section: LaboratorySection };

interface QuickTool {
    label: string;
    icon: LucideIcon;
    action: QuickToolAction;
}

const QUICK_TOOLS: QuickTool[] = [
    { label: "Mind Map", icon: Network, action: { kind: "mindmap" } },
    { label: "Whiteboard", icon: PenTool, action: { kind: "whiteboard" } },
    { label: "Ideation", icon: Lightbulb, action: { kind: "section", section: "ideas" } },
    { label: "AI Research", icon: Telescope, action: { kind: "section", section: "market-analysis" } },
    { label: "Image Gen", icon: ImagePlus, action: { kind: "section", section: "image-generation" } },
    { label: "Reports", icon: FileBarChart, action: { kind: "section", section: "analytics" } },
];

// In minutes — presets plus a "custom" sentinel that reveals a free-
// entry field instead of starting the timer directly, per explicit
// request for more granularity (5/10/30/60 min, 2/3/4 h) and the
// ability to type any duration.
const DURATION_PRESETS = [5, 10, 30, 60, 120, 180, 240];
const CUSTOM_DURATION = "custom";

function formatDurationLabel(minutes: number): string {
    return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`;
}

function formatRemaining(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

// Green while there's plenty of time left, amber past the halfway
// mark, red for the final stretch — per explicit request so the ring
// itself communicates urgency, not just the number.
function progressColor(progress: number): string {
    if (progress >= 0.9) return "var(--danger)";
    if (progress >= 0.5) return "#F5C451";
    return "var(--secondary)";
}

const RING_SIZE = 64;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type FocusState = "idle" | "running" | "paused";

// The Web Audio API isn't part of TypeScript's standard DOM lib under
// the webkit-prefixed name, same minimal-shape pattern as
// useKiwiChat.ts's SpeechRecognition handling.
function getAudioContextCtor(): typeof AudioContext | null {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * The bottom bar from the reference mockup — a row of quick-tool
 * shortcuts (Mind Map/Whiteboard open their own modal below; the other
 * four just jump the main view to the already-real Laboratory section
 * they correspond to) plus a real Focus Mode timer. The ring's
 * own center is reserved purely for numbers — the picked duration
 * while idle, the live countdown once running — rendered through the
 * exact same element at the exact same size either way, so the ring
 * never resizes or swaps in a form control, per explicit request.
 * Every actual control (Start/Pause/Resume/Stop, and the duration
 * picker itself) lives outside the ring in the two side slots instead:
 * left holds Start/Pause/Resume, right holds the duration select (or,
 * once Custom is picked, a number input plus a small "presets" link
 * back) while idle, and Stop once running. The progress arc shifts
 * from green through amber to red as the session runs out, and a
 * synthesized gong (Web Audio API, no audio asset needed) plays on
 * completion — the AudioContext is created/unlocked inside the Start
 * click handler specifically so it's not blocked by autoplay policies
 * when the gong fires later, unprompted, once time runs out.
 * Introduced an explicit idle/running/paused state machine so pausing
 * freezes the countdown without losing remaining time, distinct from
 * Stop which cancels back to the picker. Not tied to any project/task
 * yet, just a standalone session timer — no backend needed for any of
 * this.
 */
interface LaboratoryQuickBarProps {
    onOpenSection: (section: LaboratorySection) => void;
    // Mind Map/Whiteboard render as centered modals — Laboratory.tsx
    // owns that open/close state and renders them itself (same pattern
    // as searchOpen/calendarOpen/notificationsOpen), rather than this
    // component rendering them inline: .lab-quickbar has its own
    // backdrop-filter, which establishes a containing block for
    // position:fixed descendants and would silently break the modals'
    // viewport-centering if they were nested in here.
    onOpenMindMap: () => void;
    onOpenWhiteboard: () => void;
}

export default function LaboratoryQuickBar({ onOpenSection, onOpenMindMap, onOpenWhiteboard }: LaboratoryQuickBarProps) {
    const [durationChoice, setDurationChoice] = useState<string>("30");
    const [customMinutes, setCustomMinutes] = useState("25");
    const [focusState, setFocusState] = useState<FocusState>("idle");
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    const handleToolClick = (action: QuickToolAction) => {
        if (action.kind === "mindmap") onOpenMindMap();
        else if (action.kind === "whiteboard") onOpenWhiteboard();
        else onOpenSection(action.section);
    };

    const ensureAudioContext = (): AudioContext | null => {
        try {
            if (!audioCtxRef.current) {
                const Ctor = getAudioContextCtor();
                if (!Ctor) return null;
                audioCtxRef.current = new Ctor();
            }
            if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
            return audioCtxRef.current;
        } catch {
            return null;
        }
    };

    const playGong = () => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        const now = ctx.currentTime;
        // A soft three-note chime (a major triad, gently arpeggiated)
        // rather than a deep gong — the earlier low-fundamental/
        // inharmonic-partials version read as ominous rather than a
        // pleasant "you're done" cue, per explicit follow-up feedback.
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const startAt = now + i * 0.1;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, startAt);
            gain.gain.linearRampToValueAtTime(0.22, startAt + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, startAt + 1.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startAt);
            osc.stop(startAt + 1.9);
        });
    };

    useEffect(() => {
        if (focusState === "running") {
            intervalRef.current = setInterval(() => {
                setRemaining((seconds) => {
                    if (seconds <= 1) {
                        setFocusState("idle");
                        playGong();
                        return 0;
                    }
                    return seconds - 1;
                });
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [focusState]);

    const resolvedMinutes = durationChoice === CUSTOM_DURATION
        ? Math.max(1, Math.min(999, Number(customMinutes) || 0))
        : Number(durationChoice);

    const startFocus = () => {
        if (!resolvedMinutes) return;
        ensureAudioContext();
        const seconds = resolvedMinutes * 60;
        setTotalSeconds(seconds);
        setRemaining(seconds);
        setFocusState("running");
    };

    const pauseFocus = () => setFocusState("paused");
    const resumeFocus = () => setFocusState("running");
    const stopFocus = () => {
        setFocusState("idle");
        setTotalSeconds(0);
        setRemaining(0);
    };

    const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
    const ringOffset = RING_CIRCUMFERENCE * (1 - progress);
    const running = focusState !== "idle";

    return (
        <footer className="lab-quickbar">
            <div className="lab-quickbar-tools">
                {QUICK_TOOLS.map((tool) => (
                    <button key={tool.label} type="button" className="lab-quickbar-tool" onClick={() => handleToolClick(tool.action)}>
                        <tool.icon size={15} strokeWidth={1.75} />
                        <span>{tool.label}</span>
                    </button>
                ))}
            </div>

            <div className="lab-quickbar-timer">
                <div className="lab-quickbar-slot">
                    {running ? (
                        focusState === "running" ? (
                            <button type="button" className="lab-quickbar-side-btn" onClick={pauseFocus} aria-label="Pause focus session">
                                <Pause size={13} strokeWidth={2} />
                            </button>
                        ) : (
                            <button type="button" className="lab-quickbar-side-btn" onClick={resumeFocus} aria-label="Resume focus session">
                                <Play size={13} strokeWidth={2} />
                            </button>
                        )
                    ) : (
                        <button type="button" className="lab-quickbar-side-btn lab-quickbar-side-btn-start" onClick={startFocus} disabled={!resolvedMinutes} aria-label="Start focus session">
                            <Play size={14} strokeWidth={2} />
                        </button>
                    )}
                </div>

                <div className="lab-quickbar-ring">
                    <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                        <circle
                            className="lab-quickbar-ring-track"
                            cx={RING_SIZE / 2}
                            cy={RING_SIZE / 2}
                            r={RING_RADIUS}
                            strokeWidth={RING_STROKE}
                            fill="none"
                        />
                        {running && (
                            <circle
                                cx={RING_SIZE / 2}
                                cy={RING_SIZE / 2}
                                r={RING_RADIUS}
                                strokeWidth={RING_STROKE}
                                fill="none"
                                stroke={progressColor(progress)}
                                strokeLinecap="round"
                                strokeDasharray={RING_CIRCUMFERENCE}
                                strokeDashoffset={ringOffset}
                                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                                style={{ transition: "stroke-dashoffset 1s linear, stroke .4s ease" }}
                            />
                        )}
                    </svg>

                    <div className="lab-quickbar-ring-center">
                        {/* Always just the numbers, in the exact same
                            spot at the exact same size, whether that's
                            the picked duration sitting idle or the
                            live countdown — the ring itself never
                            resizes or swaps in a control, per explicit
                            request. */}
                        <span className="lab-quickbar-ring-time">
                            {formatRemaining(running ? remaining : resolvedMinutes * 60)}
                        </span>
                    </div>
                </div>

                <div className="lab-quickbar-slot">
                    {running ? (
                        <button type="button" className="lab-quickbar-side-btn lab-quickbar-side-btn-stop" onClick={stopFocus} aria-label="Stop focus session">
                            <Square size={12} strokeWidth={2} />
                        </button>
                    ) : (
                        // One fixed-size pill either way — picking
                        // "Custom" swaps the <select> for a number
                        // input inside the exact same box rather than
                        // growing/shifting the layout, per explicit
                        // request. The tiny back-chevron (only shown
                        // in custom mode) returns to the preset list.
                        <div className="lab-quickbar-duration-control">
                            {durationChoice === CUSTOM_DURATION ? (
                                <>
                                    <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        className="lab-quickbar-duration-value"
                                        value={customMinutes}
                                        onChange={(e) => setCustomMinutes(e.target.value)}
                                        placeholder="min"
                                        aria-label="Custom focus duration in minutes"
                                    />
                                    <button type="button" className="lab-quickbar-duration-back" onClick={() => setDurationChoice("30")} aria-label="Back to presets">
                                        <ChevronLeft size={11} strokeWidth={2.25} />
                                    </button>
                                </>
                            ) : (
                                <select
                                    className="lab-quickbar-duration-select"
                                    value={durationChoice}
                                    onChange={(e) => setDurationChoice(e.target.value)}
                                    aria-label="Focus duration"
                                >
                                    {DURATION_PRESETS.map((minutes) => (
                                        <option key={minutes} value={minutes}>{formatDurationLabel(minutes)}</option>
                                    ))}
                                    <option value={CUSTOM_DURATION}>Custom</option>
                                </select>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </footer>
    );
}
