import CommandBar from "./CommandBar";
import "./TopBar.css";

/**
 * Top navigation bar for KIWI HQ.
 *
 * Note: "System Status" here is a high-level, whole-system health
 * indicator (currently a static placeholder — will later reflect real
 * agent/service health, e.g. "degraded" if an AI agent is down).
 *
 * This is intentionally a *different* concept from `kiwiStore.status`,
 * which reports the outcome of the last executed command (e.g. "Error",
 * "Helping") and is shown in the bottom StatusBar. Reusing one value for
 * both would mean a single failed command turns the whole system
 * indicator red, which isn't the intent.
 */
export default function TopBar() {
    return (
        <header className="top-bar">

            <div className="top-bar-brand">

                <div className="brand-logo">🥝</div>

                <div className="brand-text">
                    <span className="brand-title">KIWI</span>
                    <span className="brand-subtitle">AI Operation System</span>
                </div>

            </div>

            <div className="top-bar-search">
                <CommandBar />
            </div>

            <div className="top-bar-status">

                <span className="status-dot" />

                <div className="status-text">
                    <span className="status-label">System Status</span>
                    <span className="status-value">All Systems Operational</span>
                </div>

            </div>

        </header>
    );
}
