import { useState, type MouseEvent } from "react";
import LaboratoryTopBar from "./LaboratoryTopBar";
import LaboratorySidebar from "./LaboratorySidebar";
import LaboratoryQuickBar from "./LaboratoryQuickBar";
import LaboratorySearch from "./LaboratorySearch";
import CalendarPanel from "./CalendarPanel";
import ProjectGrid from "./ProjectGrid";
import ProjectWorkspace from "./ProjectWorkspace";
import NotesGrid from "./NotesGrid";
import NoteEditor from "./NoteEditor";
import ResearchGrid from "./ResearchGrid";
import ResearchDetail from "./ResearchDetail";
import KiwiPanel from "./KiwiPanel";
import DetailDrawer, { type DetailDrawerContent } from "../ui/DetailDrawer";
import ProfileSettings from "../ui/ProfileSettings";
import { useKiwiChat } from "../../lib/useKiwiChat";
import { MOCK_PROJECTS, createMockProject, type LaboratoryProject } from "../../state/laboratoryProjects";
import { MOCK_NOTES, createMockNote, type LabNote } from "../../state/laboratoryNotes";
import { MOCK_RESEARCH, createMockResearchEntry, type ResearchEntry } from "../../state/laboratoryResearch";
import { resolveBackgroundImage } from "../../state/backgrounds";
import type { AccountState } from "../../state/account";
import type { CalendarState } from "../../state/calendar";
import "./Laboratory.css";

export type LaboratorySection = "projects" | "research" | "notes";

interface LaboratoryProps {
    onBack: () => void;
    account: AccountState;
    calendar: CalendarState;
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
 * Three top-level sections (Projects/Research/Notes, switched from the
 * left sidebar) each follow the same grid -> detail shape: pick an
 * item, walk into its own page, come back. Research and Notes here are
 * deliberately GLOBAL/cross-project (a scratchpad and a findings list
 * that don't belong to any one project yet) — each project also has
 * its own "Research"/"Notes" MODULE tab inside ProjectWorkspace, which
 * is a separate, still-placeholder concept.
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
 * `account` is owned by App.tsx and passed down here too — the profile
 * pill (see LaboratoryTopBar) reflects whoever is actually signed in
 * on the Dashboard, and clicking it opens the exact same
 * ProfileSettings drawer (same DetailDrawer pattern as BrainScene3D,
 * including the "build the body fresh every render" fix for the same
 * stale-closure bug — see profileAnchor below). Background is also
 * account state now, so this page's own backdrop reflects whatever the
 * user picked from either scene, not a fixed default.
 *
 * `calendar` is likewise owned by App.tsx (state/calendar.ts) — the
 * exact same event list the Dashboard's Upcoming Events widget reads,
 * so an event added from CalendarPanel here shows up there too.
 */
export default function Laboratory({ onBack, account, calendar }: LaboratoryProps) {
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
    const [searchOpen, setSearchOpen] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);

    // Same "build fresh every render" approach as BrainScene3D's own
    // profileAnchor — storing a pre-rendered <ProfileSettings/> node
    // would freeze its props at click-time (see that file's own
    // comment for the full explanation of the stale-closure bug this
    // avoids).
    const [profileAnchor, setProfileAnchor] = useState<{ x: number; y: number } | null>(null);
    const handleProfileClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setProfileAnchor({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    };
    const profileDetail: DetailDrawerContent | null = profileAnchor ? {
        title: "Profile & settings",
        anchor: profileAnchor,
        maxHeight: 620,
        body: <ProfileSettings account={account} onSignOut={() => { account.setNickname(null); setProfileAnchor(null); }} />,
    } : null;

    const handleCreateProject = () => {
        const project = createMockProject();
        setProjects((prev) => [project, ...prev]);
        setSelectedProjectId(project.id);
        setSection("projects");
    };

    const handleProjectChange = (id: string, changes: Partial<Pick<LaboratoryProject, "name" | "category" | "description">>) => {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes, lastActivity: "Just now" } : p)));
    };

    const handleAddTask = (projectId: string, title: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, tasks: [...p.tasks, { id: `task-${Date.now()}`, title, done: false }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleToggleTask = (projectId: string, taskId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)), lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveTask = (projectId: string, taskId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }
                : p
        )));
    };

    const handleCreateNote = () => {
        const note = createMockNote();
        setNotes((prev) => [note, ...prev]);
        setSelectedNoteId(note.id);
    };

    const handleNoteChange = (id: string, changes: Partial<Pick<LabNote, "title" | "content">>) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes, updatedAt: "Just now" } : n)));
    };

    // Reuses the exact same createMockNote() the global Notes section
    // uses — same "Untitled Note N" starting point either way. Returns
    // the new note's id synchronously (the note itself is generated
    // before setProjects runs) so ProjectWorkspace can jump straight
    // into editing it.
    const handleAddProjectNote = (projectId: string): string => {
        const note = createMockNote();
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, notes: [note, ...p.notes] } : p)));
        return note.id;
    };

    const handleProjectNoteChange = (projectId: string, noteId: string, changes: Partial<Pick<LabNote, "title" | "content">>) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, notes: p.notes.map((n) => (n.id === noteId ? { ...n, ...changes, updatedAt: "Just now" } : n)) }
                : p
        )));
    };

    const handleCreateResearchEntry = () => {
        const entry = createMockResearchEntry();
        setResearchEntries((prev) => [entry, ...prev]);
        setSelectedResearchId(entry.id);
    };

    const handleResearchChange = (id: string, changes: Partial<Pick<ResearchEntry, "title" | "summary" | "tag" | "source">>) => {
        setResearchEntries((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes, savedAt: "Just now" } : r)));
    };

    const handleSearchSelect = (kind: "project" | "note" | "research", id: string) => {
        if (kind === "project") { setSection("projects"); setSelectedProjectId(id); }
        else if (kind === "note") { setSection("notes"); setSelectedNoteId(id); }
        else { setSection("research"); setSelectedResearchId(id); }
    };

    return (
        <div
            className="laboratory"
            style={{ backgroundImage: `linear-gradient(rgba(2,6,17,0.55), rgba(2,6,17,0.55)), ${resolveBackgroundImage(account.background)}` }}
        >
            <LaboratoryTopBar
                onBack={onBack}
                listening={kiwiChat.listening}
                onOpenKiwi={() => setKiwiOpen(true)}
                onOpenSearch={() => setSearchOpen(true)}
                onOpenCalendar={() => setCalendarOpen(true)}
                nickname={account.nickname}
                avatar={account.avatar}
                onProfileClick={handleProfileClick}
                projectCount={projects.length}
                activeProjectCount={projects.filter((p) => p.status === "active").length}
                noteCount={notes.length}
                researchCount={researchEntries.length}
            />

            <div className="laboratory-body">
                <LaboratorySidebar
                    section={section}
                    onSectionChange={setSection}
                    onCreateProject={handleCreateProject}
                    onOpenKiwi={() => setKiwiOpen(true)}
                />

                <main className="laboratory-main">
                    {section === "projects" && (
                        selectedProject ? (
                            <ProjectWorkspace
                                project={selectedProject}
                                onBack={() => setSelectedProjectId(null)}
                                onChange={handleProjectChange}
                                onAddTask={handleAddTask}
                                onToggleTask={handleToggleTask}
                                onRemoveTask={handleRemoveTask}
                                onAddNote={handleAddProjectNote}
                                onNoteChange={handleProjectNoteChange}
                            />
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
            </div>

            <LaboratoryQuickBar />

            {kiwiOpen && (
                <KiwiPanel
                    onClose={() => setKiwiOpen(false)}
                    {...kiwiChat}
                    project={section === "projects" ? selectedProject : null}
                />
            )}

            {searchOpen && (
                <LaboratorySearch
                    onClose={() => setSearchOpen(false)}
                    projects={projects}
                    notes={notes}
                    researchEntries={researchEntries}
                    onSelect={handleSearchSelect}
                />
            )}

            {calendarOpen && (
                <CalendarPanel
                    onClose={() => setCalendarOpen(false)}
                    events={calendar.events}
                    onAddEvent={calendar.addEvent}
                    onRemoveEvent={calendar.removeEvent}
                />
            )}

            <DetailDrawer content={profileDetail} onClose={() => setProfileAnchor(null)} />
        </div>
    );
}
