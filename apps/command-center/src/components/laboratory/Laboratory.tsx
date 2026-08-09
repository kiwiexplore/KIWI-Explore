import { useState } from "react";
import LaboratoryTopBar from "./LaboratoryTopBar";
import ProjectGrid from "./ProjectGrid";
import ProjectWorkspace from "./ProjectWorkspace";
import NotesGrid from "./NotesGrid";
import NoteEditor from "./NoteEditor";
import ResearchGrid from "./ResearchGrid";
import ResearchDetail from "./ResearchDetail";
import KiwiPanel from "./KiwiPanel";
import { useKiwiChat } from "../../lib/useKiwiChat";
import { MOCK_PROJECTS, createMockProject, type LaboratoryProject } from "../../state/laboratoryProjects";
import { MOCK_NOTES, createMockNote, type LabNote } from "../../state/laboratoryNotes";
import { MOCK_RESEARCH, createMockResearchEntry, type ResearchEntry } from "../../state/laboratoryResearch";
import { resolveBackgroundImage, DEFAULT_BACKGROUND } from "../../state/backgrounds";
import type { AccountState } from "../../state/account";
import "./Laboratory.css";

export type LaboratorySection = "projects" | "research" | "notes";

interface LaboratoryProps {
    onBack: () => void;
    account: AccountState;
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
 * Three top-level sections (Projects/Research/Notes, switched via
 * LaboratoryTopBar's nav) each follow the same grid -> detail shape:
 * pick an item, walk into its own page, come back. Research and Notes
 * here are deliberately GLOBAL/cross-project (a scratchpad and a
 * findings list that don't belong to any one project yet) — each
 * project also has its own "Research"/"Notes" MODULE tab inside
 * ProjectWorkspace, which is a separate, still-placeholder concept.
 *
 * Own top-level state for all three lists and which item (if any) is
 * open in each — mock/in-memory only, same as everything else in the
 * account system (no backend yet). Selecting an item swaps the grid
 * for its detail view entirely, rather than layering a drawer on top —
 * this is meant to feel like walking into the thing, not glancing at a
 * card, per explicit request ("Laboratory = tvorba + soustředění").
 *
 * useKiwiChat is called here (not inside KiwiPanel) so the same
 * `listening` value can drive both KiwiPanel itself AND
 * KiwiCoreBadge's rotation-pause/glow-boost reaction, exactly like
 * BrainScene3D does for VoiceBar/the Dashboard's own brain.
 *
 * `account` (nickname/avatar/plan) is owned by App.tsx and passed down
 * here too — see LaboratoryTopBar, whose profile pill reflects whoever
 * is actually signed in on the Dashboard instead of a fixed
 * placeholder name. Editing the account (sign in/out, change avatar or
 * plan) still only happens from the Dashboard's own ProfileSettings —
 * Laboratory's pill is a read-only reflection of it for now.
 */
export default function Laboratory({ onBack, account }: LaboratoryProps) {
    const [section, setSection] = useState<LaboratorySection>("projects");

    const [projects, setProjects] = useState<LaboratoryProject[]>(MOCK_PROJECTS);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

    const [notes, setNotes] = useState<LabNote[]>(MOCK_NOTES);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

    const [researchEntries, setResearchEntries] = useState<ResearchEntry[]>(MOCK_RESEARCH);
    const [selectedResearchId, setSelectedResearchId] = useState<string | null>(null);
    const selectedResearch = researchEntries.find((r) => r.id === selectedResearchId) ?? null;

    const [kiwiOpen, setKiwiOpen] = useState(false);
    const kiwiChat = useKiwiChat();

    const handleCreateProject = () => {
        const project = createMockProject();
        setProjects((prev) => [project, ...prev]);
        setSelectedProjectId(project.id);
    };

    const handleCreateNote = () => {
        const note = createMockNote();
        setNotes((prev) => [note, ...prev]);
        setSelectedNoteId(note.id);
    };

    const handleNoteChange = (id: string, changes: Partial<Pick<LabNote, "title" | "content">>) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes, updatedAt: "Just now" } : n)));
    };

    const handleCreateResearchEntry = () => {
        const entry = createMockResearchEntry();
        setResearchEntries((prev) => [entry, ...prev]);
        setSelectedResearchId(entry.id);
    };

    const handleResearchChange = (id: string, changes: Partial<Pick<ResearchEntry, "title" | "summary" | "tag" | "source">>) => {
        setResearchEntries((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes, savedAt: "Just now" } : r)));
    };

    return (
        <div
            className="laboratory"
            style={{ backgroundImage: `linear-gradient(rgba(2,6,17,0.55), rgba(2,6,17,0.55)), ${resolveBackgroundImage(DEFAULT_BACKGROUND)}` }}
        >
            <LaboratoryTopBar
                onBack={onBack}
                listening={kiwiChat.listening}
                onOpenKiwi={() => setKiwiOpen(true)}
                section={section}
                onSectionChange={setSection}
                nickname={account.nickname}
                avatar={account.avatar}
            />

            <main className="laboratory-main">
                {section === "projects" && (
                    selectedProject ? (
                        <ProjectWorkspace project={selectedProject} onBack={() => setSelectedProjectId(null)} />
                    ) : (
                        <ProjectGrid projects={projects} onSelectProject={setSelectedProjectId} onCreateProject={handleCreateProject} />
                    )
                )}

                {section === "research" && (
                    selectedResearch ? (
                        <ResearchDetail entry={selectedResearch} onBack={() => setSelectedResearchId(null)} onChange={handleResearchChange} />
                    ) : (
                        <ResearchGrid entries={researchEntries} onSelectEntry={setSelectedResearchId} onCreateEntry={handleCreateResearchEntry} />
                    )
                )}

                {section === "notes" && (
                    selectedNote ? (
                        <NoteEditor note={selectedNote} onBack={() => setSelectedNoteId(null)} onChange={handleNoteChange} />
                    ) : (
                        <NotesGrid notes={notes} onSelectNote={setSelectedNoteId} onCreateNote={handleCreateNote} />
                    )
                )}
            </main>

            {kiwiOpen && <KiwiPanel onClose={() => setKiwiOpen(false)} {...kiwiChat} />}
        </div>
    );
}
