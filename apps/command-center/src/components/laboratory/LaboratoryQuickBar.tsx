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

const DURATION_OPTIONS = [15, 25, 45, 60];

function formatRemaining(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

/**
 * The bottom bar from the reference mockup — a row of quick-tool
 * shortcuts (all placeholders, "Soon" badged, same as the sidebar's
 * own not-yet-built modules) plus a real Focus Mode timer. Pick a
 * duration first (15/25/45/60 min, so you actually know how long
 * you're committing to before starting — per explicit request), then
 * it counts DOWN from there and stops itself on its own once it hits
 * zero. Not tied to any project/task yet, just a standalone session
 * timer — no backend needed for any of this.
 */
export default function LaboratoryQuickBar() {
    const [durationMinutes, setDurationMinutes] = useState(25);
    const [focusActive, setFocusActive] = useState(false);
    const [remaining, setRemaining] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (focusActive) {
            intervalRef.current = setInterval(() => {
                setRemaining((seconds) => {
                    if (seconds <= 1) {
                        setFocusActive(false);
                        return 0;
                    }
                    return seconds - 1;
                });
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [focusActive]);

    const startFocus = () => {
        setRemaining(durationMinutes * 60);
        setFocusActive(true);
    };

    const stopFocus = () => setFocusActive(false);

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

            {focusActive ? (
                <button type="button" className="lab-quickbar-focus lab-quickbar-focus-active" onClick={stopFocus}>
                    <Pause size={14} strokeWidth={2} />
                    <Timer size={14} strokeWidth={2} />
                    {formatRemaining(remaining)}
                </button>
            ) : (
                <div className="lab-quickbar-focus-setup">
                    <select
                        className="lab-quickbar-duration"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        aria-label="Focus duration"
                    >
                        {DURATION_OPTIONS.map((minutes) => (
                            <option key={minutes} value={minutes}>{minutes} min</option>
                        ))}
                    </select>
                    <button type="button" className="lab-quickbar-focus" onClick={startFocus}>
                        <Play size={14} strokeWidth={2} />
                        Start Focus
                    </button>
                </div>
            )}
        </footer>
    );
}
