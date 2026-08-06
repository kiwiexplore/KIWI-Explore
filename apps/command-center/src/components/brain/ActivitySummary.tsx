import { Sparkles } from "lucide-react";
import "./ActivitySummary.css";

/**
 * Sits in the space above the brain — a brief "what happened while you
 * were away" summary, so coming back to the dashboard gives some sense
 * of what the system has been doing, not just a static scene. Purely a
 * placeholder for now (no backend tracking real activity yet, same as
 * every other "No data available" widget in this scene) — the honest
 * empty state here rather than fabricated example activity.
 */
export default function ActivitySummary() {
    return (
        <div className="activity-summary">
            <Sparkles size={16} color="#8fd6ff" strokeWidth={1.75} />
            <span className="activity-summary-text">
                No new activity while you were away.
            </span>
        </div>
    );
}
