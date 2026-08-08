import { useState } from "react";
import LaboratoryTopBar from "./LaboratoryTopBar";
import ProjectGrid from "./ProjectGrid";
import ProjectWorkspace from "./ProjectWorkspace";
import KiwiPanel from "./KiwiPanel";
import { useKiwiChat } from "../../lib/useKiwiChat";
import { MOCK_PROJECTS, createMockProject, type LaboratoryProject } from "../../state/laboratoryProjects";
import { resolveBackgroundImage, DEFAULT_BACKGROUND } from "../../state/backgrounds";
import "./Laboratory.css";

interface LaboratoryProps {
    onBack: () => void;
}

/**
 * Laboratory — a separate, focus-only workspace for building projects,
 * deliberately apart from the KIWI HQ dashboard (see App.tsx's view
 * switch). Reuses the Dashboard's own design tokens (src/styles/
 * theme.css) and default background so it reads as an obvious extension
 * of the same system rather than a different app, but is otherwise a
 * fully separate component tree under components/laboratory/ — nothing
 * here touches the Dashboard's own working files, and nothing in the
 * Dashboard depends on this existing.
 *
 * Own top-level state for the project list and which one (if any) is
 * open — mock/in-memory only, same as everything else in the account
 * system (no backend yet). Selecting a project swaps ProjectGrid for
 * ProjectWorkspace entirely, rather than layering a drawer on top —
 * this is meant to feel like walking into a project, not glancing at a
 * card, per explicit request ("Laboratory = tvorba + soustředění").
 *
 * useKiwiChat is called here (not inside KiwiPanel) so the same
 * `listening` value can drive both KiwiPanel itself AND
 * KiwiCoreBadge's rotation-pause/glow-boost reaction, exactly like
 * BrainScene3D does for VoiceBar/the Dashboard's own brain.
 *
 * Known gap for now: the profile pill (see LaboratoryTopBar) shows a
 * local placeholder name, not whatever's actually signed in on the
 * Dashboard — BrainScene3D's account state (nickname/avatar/plan/...)
 * is local to that component, and lifting it into something both
 * scenes can share is its own step, not bundled into this one.
 */
export default function Laboratory({ onBack }: LaboratoryProps) {
    const [projects, setProjects] = useState<LaboratoryProject[]>(MOCK_PROJECTS);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selectedProject = projects.find((p) => p.id === selectedId) ?? null;
    const [kiwiOpen, setKiwiOpen] = useState(false);
    const kiwiChat = useKiwiChat();

    const handleCreateProject = () => {
        const project = createMockProject();
        setProjects((prev) => [project, ...prev]);
        setSelectedId(project.id);
    };

    return (
        <div
            className="laboratory"
            style={{ backgroundImage: `linear-gradient(rgba(2,6,17,0.55), rgba(2,6,17,0.55)), ${resolveBackgroundImage(DEFAULT_BACKGROUND)}` }}
        >
            <LaboratoryTopBar onBack={onBack} listening={kiwiChat.listening} onOpenKiwi={() => setKiwiOpen(true)} />

            <main className="laboratory-main">
                {selectedProject ? (
                    <ProjectWorkspace project={selectedProject} onBack={() => setSelectedId(null)} />
                ) : (
                    <ProjectGrid projects={projects} onSelectProject={setSelectedId} onCreateProject={handleCreateProject} />
                )}
            </main>

            {kiwiOpen && <KiwiPanel onClose={() => setKiwiOpen(false)} {...kiwiChat} />}
        </div>
    );
}
