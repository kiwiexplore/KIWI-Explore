import { Bell, FileText, Info as InfoIcon, ShieldCheck } from "lucide-react";
import "./InfoPanel.css";

/**
 * Placeholder "About / Info" panel — opened from TopBar's Info icon.
 * Each section below is structural only for now (no real project
 * write-up, ToS, or changelog wired up yet) — same pattern as
 * ProfileSettings — it exists so the entry point is already in place for
 * when that content gets written.
 */
export default function InfoPanel() {
    return (
        <div className="info-panel">
            <div className="info-panel-section">
                <span className="info-panel-section-label">
                    <InfoIcon size={16} strokeWidth={1.75} />
                    About this project
                </span>
                <span className="info-panel-section-hint">Coming soon</span>
            </div>

            <div className="info-panel-section">
                <span className="info-panel-section-label">
                    <FileText size={16} strokeWidth={1.75} />
                    Terms &amp; conditions
                </span>
                <span className="info-panel-section-hint">Coming soon</span>
            </div>

            <div className="info-panel-section">
                <span className="info-panel-section-label">
                    <ShieldCheck size={16} strokeWidth={1.75} />
                    Privacy policy
                </span>
                <span className="info-panel-section-hint">Coming soon</span>
            </div>

            <div className="info-panel-section">
                <span className="info-panel-section-label">
                    <Bell size={16} strokeWidth={1.75} />
                    Updates
                </span>
                <span className="info-panel-section-hint">Coming soon</span>
            </div>
        </div>
    );
}
