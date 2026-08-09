import { useEffect, useRef, useState } from "react";
import {
    FileBarChart, ImagePlus, Lightbulb, Network, Pause, PenTool, Play, Telescope, Timer,
    type LucideIcon,
} from "lucide-react";
import "./LaboratoryQuickBar.css";

interface QuickTool {
    label: string;
    icon: LucideIcon;
}

// All placeholders for now (per the reference mockup's own Quick Tools
// row) — none of these open anything yet, same honest "Soon" pattern
// used across the rest of Laboratory.
const QUICK_TOOLS: QuickTool[] = [
    { label: "Mind Map", icon: Network },
    { label: "Whiteboard", icon: PenTool },
    { label: "Ideation", icon: Lightbulb },
    { label: "AI Research", icon: Telescope },
    { label: "Image Gen", icon: ImagePlus },
    { label: "Reports", icon: FileBarChart },
];

function formatElapsed(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

/**
 * The bottom bar from the reference mockup — a row of quick-tool
 * shortcuts (all placeholders, "Soon" badged, same as the sidebar's
 * own not-yet-built modules) plus a real Focus Mode timer. The timer
 * itself is genuinely functional (counts up while active, no backend
 * needed for that) even though nothing else here is — it's a simple
 * self-contained stopwatch, not tied to any project/task yet.
 */
export default function LaboratoryQuickBar() {
    const [focusActive, setFocusActive] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (focusActive) {
            intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [focusActive]);

    const toggleFocus = () => {
        if (focusActive) {
            setFocusActive(false);
        } else {
            setElapsed(0);
            setFocusActive(true);
        }
    };

    return (
        <footer className="lab-quickbar">
            <div className="lab-quickbar-tools">
                {QUICK_TOOLS.map((tool) => (
                    <button key={tool.label} type="button" className="lab-quickbar-tool" disabled>
                        <tool.icon size={15} strokeWidth={1.75} />
                        <span>{tool.label}</span>
                        <span className="lab-quickbar-tool-badge">Soon</span>
                    </button>
                ))}
            </div>

            <button
                type="button"
                className={`lab-quickbar-focus${focusActive ? " lab-quickbar-focus-active" : ""}`}
                onClick={toggleFocus}
            >
                {focusActive ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
                {focusActive ? (
                    <>
                        <Timer size={14} strokeWidth={2} />
                        {formatElapsed(elapsed)}
                    </>
                ) : (
                    "Start Focus"
                )}
            </button>
        </footer>
    );
}
