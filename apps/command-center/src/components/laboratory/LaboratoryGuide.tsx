import { Check, ChevronRight, Circle, Dot, Plus } from "lucide-react";
import type { LaboratorySection } from "./Laboratory";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import { deriveJourney, type PhaseProgress } from "../../state/laboratoryJourney";
import "./GlobalBoard.css";
import "./LaboratoryGuide.css";

interface LaboratoryGuideProps {
    projects: LaboratoryProject[];
    /** Which project the journey is being read for. */
    focusProject: LaboratoryProject | null;
    onFocusProject: (id: string) => void;
    onGoToSection: (section: LaboratorySection) => void;
    onOpenProject: (id: string) => void;
    onCreateProject: () => void;
}

function PhaseRow({ progress, onGoToSection }: { progress: PhaseProgress; onGoToSection: (s: LaboratorySection) => void }) {
    const { phase, status, detail, reason } = progress;

    return (
        <li className={`lab-guide-phase lab-guide-phase-${status}`}>
            <div className="lab-guide-phase-marker" aria-hidden="true">
                <span className="lab-guide-phase-dot">
                    {status === "done" ? <Check size={13} strokeWidth={3} />
                        : status === "active" ? <Circle size={9} strokeWidth={4} />
                            : <Dot size={16} strokeWidth={3} />}
                </span>
            </div>

            <div className="lab-guide-phase-body">
                <div className="lab-guide-phase-head">
                    <span className="lab-guide-phase-step">Step {phase.step}</span>
                    <h3>{phase.label}</h3>
                    {detail && <span className="lab-guide-phase-detail">{detail}</span>}
                    {status === "active" && <span className="lab-guide-phase-here">You're here</span>}
                </div>

                {/* Done phases keep only their one-line summary — the
                    point of collapsing them is that finished work should
                    stop competing for attention with what's next. */}
                {status !== "done" && <p className="lab-guide-phase-blurb">{phase.blurb}</p>}

                {reason && <p className="lab-guide-phase-reason">{reason}</p>}

                <div className="lab-guide-phase-links">
                    {phase.sections.map((entry) => (
                        <button
                            key={entry.section}
                            type="button"
                            className="lab-guide-phase-link"
                            onClick={() => onGoToSection(entry.section)}
                        >
                            {entry.label}
                            <ChevronRight size={13} strokeWidth={2} />
                        </button>
                    ))}
                </div>
            </div>
        </li>
    );
}

/**
 * The Laboratory's front door — the same twenty-odd sections that were
 * always here, laid out as the order you'd actually do them in rather
 * than as four unexplained groups in a sidebar.
 *
 * Every phase stays visible at once (per explicit request): finished
 * ones collapse to a single line with a tick, the one you're on is
 * highlighted and expanded, and later ones are dimmed and say what
 * they're usually waiting for. None of them are locked — the reason
 * text is advice about ordering, not a rule, and clicking straight
 * through to any section still works.
 *
 * The journey is read for ONE project at a time (picked at the top),
 * because "where am I" has no meaning averaged across three unrelated
 * projects.
 */
export default function LaboratoryGuide({
    projects, focusProject, onFocusProject, onGoToSection, onOpenProject, onCreateProject,
}: LaboratoryGuideProps) {
    const journey = deriveJourney(focusProject);
    const doneCount = journey.filter((p) => p.status === "done").length;

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Where you are</h1>
                </div>
                {focusProject && <span className="global-board-summary">{doneCount}/{journey.length} phases started</span>}
            </div>

            {projects.length === 0 ? (
                <div className="lab-guide-empty">
                    <p>Nothing to walk through yet. A project is the thing the seven steps below are about.</p>
                    <button type="button" className="lab-guide-create" onClick={onCreateProject}>
                        <Plus size={15} strokeWidth={2} />
                        Create your first project
                    </button>
                </div>
            ) : (
                <div className="lab-guide-focus">
                    <label className="lab-guide-focus-picker">
                        <span>Following</span>
                        <select value={focusProject?.id ?? ""} onChange={(e) => onFocusProject(e.target.value)}>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </select>
                    </label>
                    {focusProject && (
                        <button type="button" className="lab-guide-open-project" onClick={() => onOpenProject(focusProject.id)}>
                            Open project workspace
                            <ChevronRight size={13} strokeWidth={2} />
                        </button>
                    )}
                </div>
            )}

            <ol className="lab-guide-phases">
                {journey.map((progress) => (
                    <PhaseRow key={progress.phase.id} progress={progress} onGoToSection={onGoToSection} />
                ))}
            </ol>
        </div>
    );
}
