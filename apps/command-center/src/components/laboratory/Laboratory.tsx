import { useEffect, useState } from "react";
import LaboratoryTopBar from "./LaboratoryTopBar";
import LaboratorySidebar from "./LaboratorySidebar";
import LaboratoryQuickBar from "./LaboratoryQuickBar";
import LaboratorySearch from "./LaboratorySearch";
import CalendarPanel from "./CalendarPanel";
import NotificationsPanel from "./NotificationsPanel";
import Overview from "./Overview";
import TasksBoard from "./TasksBoard";
import IdeasBoard from "./IdeasBoard";
import DesignStudioBoard from "./DesignStudioBoard";
import PrototypesBoard from "./PrototypesBoard";
import ResourcesBoard from "./ResourcesBoard";
import TestsBoard from "./TestsBoard";
import DocumentsBoard from "./DocumentsBoard";
import ProductsBoard from "./ProductsBoard";
import StoreBoard from "./StoreBoard";
import MarketingBoard from "./MarketingBoard";
import AnalyticsPage from "./AnalyticsPage";
import ImageGenerationBoard from "./ImageGenerationBoard";
import MarketAnalysisBoard from "./MarketAnalysisBoard";
import TrendScannerBoard from "./TrendScannerBoard";
import ContentHubBoard from "./ContentHubBoard";
import VideoStudioBoard from "./VideoStudioBoard";
import MindMapView from "./MindMapView";
import WhiteboardCanvas from "./WhiteboardCanvas";
import ProjectGrid from "./ProjectGrid";
import ProjectWorkspace from "./ProjectWorkspace";
import NotesGrid from "./NotesGrid";
import NoteEditor from "./NoteEditor";
import ResearchGrid from "./ResearchGrid";
import ResearchDetail from "./ResearchDetail";
import KiwiPanel from "./KiwiPanel";
import { useKiwiChat } from "../../lib/useKiwiChat";
import { resolveBackgroundImage } from "../../state/backgrounds";
import type { NotificationsState } from "../../state/notifications";
import { useContentHubState } from "../../state/contentHub";
import { useVideoStudioState } from "../../state/videoStudio";
import type { AccountState } from "../../state/account";
import type { CalendarState } from "../../state/calendar";
import type { LaboratoryDataState } from "../../state/laboratoryData";
import type { SpotifyState } from "../../state/spotify";
import "./Laboratory.css";

export type LaboratorySection =
    | "overview" | "projects" | "research" | "notes"
    | "tasks" | "ideas" | "design" | "prototypes"
    | "resources" | "tests" | "documents"
    | "products" | "store" | "marketing" | "analytics"
    | "image-generation" | "market-analysis" | "trend-scanner" | "content-hub" | "video-studio";

interface LaboratoryProps {
    onBack: () => void;
    notifications: NotificationsState;
    account: AccountState;
    calendar: CalendarState;
    data: LaboratoryDataState;
    spotify: SpotifyState;
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
 * Four top-level sections (Overview/Projects/Research/Notes, switched
 * from the left sidebar). Overview is a read-only snapshot across the
 * other three (recent projects, open tasks, recent notes/research) and
 * is the default landing section; Projects/Research/Notes each follow
 * their own grid -> detail shape: pick an item, walk into its own
 * page, come back. Research and Notes here are
 * deliberately GLOBAL/cross-project (a scratchpad and a findings list
 * that don't belong to any one project yet) — each project also has
 * its own "Research"/"Notes" MODULE tab inside ProjectWorkspace, which
 * is a separate, still-placeholder concept.
 *
 * The actual data (projects/notes/researchEntries) and its mutations
 * now live in `data` (state/laboratoryData.ts, owned by App.tsx) —
 * same lift-to-App.tsx pattern as account/calendar, so the Dashboard's
 * Notes/Projects widgets can read the exact same lists Laboratory
 * itself edits, rather than a second copy that resets on unmount. This
 * component still owns which item (if any) is open in each list —
 * selecting an item swaps the grid for its detail view entirely,
 * rather than layering a drawer on top — this is meant to feel like
 * walking into the thing, not glancing at a card, per explicit request
 * ("Laboratory = tvorba + soustředění").
 *
 * useKiwiChat is called here (not inside KiwiPanel) so the same
 * `listening` value can drive both KiwiPanel itself AND
 * KiwiCoreBadge's rotation-pause/glow-boost reaction, exactly like
 * BrainScene3D does for VoiceBar/the Dashboard's own brain.
 *
 * `account` is owned by App.tsx and passed down here only for the page
 * backdrop. The profile pill and its settings drawer that used to live
 * in this scene's top bar are gone (removed per explicit request, along
 * with the Dashboard's own sign-in — the account isn't needed at this
 * stage), so nothing here reads or writes an identity any more.
 *
 * `calendar` is likewise owned by App.tsx (state/calendar.ts) — the
 * exact same event list the Dashboard's Upcoming Events widget reads,
 * so an event added from CalendarPanel here shows up there too.
 */
// How long the glare takes to cover the room before the dashboard
// takes over. Matches the arrival's own timing on the other side.
const LEAVE_MS = 1300;

export default function Laboratory({ onBack, account, calendar, data, spotify, notifications }: LaboratoryProps) {
    // Leaving is a flight, not a cut: the glare comes up over the room
    // the same way it came down on arrival, and the dashboard picks the
    // camera up out at the Moon and flies it home (see BrainScene3D's
    // `arriving`). The two halves have to agree on this timing.
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        if (!leaving) return;
        const timer = window.setTimeout(onBack, LEAVE_MS);
        return () => window.clearTimeout(timer);
    }, [leaving, onBack]);

    const {
        projects, notes, researchEntries,
        createProject, handleProjectChange,
        handleAddTask, handleToggleTask, handleRemoveTask,
        handleAddIdea, handleRemoveIdea,
        handleAddDesignRef, handleRemoveDesignRef,
        handleAddPrototype, handleCyclePrototypeStage, handleRemovePrototype,
        handleAddFile, handleRemoveFile,
        handleAddModel, handleRemoveModel,
        handleAddResource, handleRemoveResource,
        handleAddTest, handleCycleTestStatus, handleRemoveTest,
        handleAddDocument, handleRemoveDocument,
        handleAddProduct, handleUpdateProductSpecs, handleCycleProductStage, handleRemoveProduct,
        handleAddStoreChannel, handleRemoveStoreChannel,
        handleAddMarketingItem, handleCycleMarketingStatus, handleRemoveMarketingItem,
        handleAddImagePrompt, handleRemoveImagePrompt,
        handleAddMarketQuery, handleRemoveMarketQuery,
        handleAddTrendTopic, handleRemoveTrendTopic,
        createNote, handleNoteChange, handleAddProjectNote, handleProjectNoteChange,
        createResearchEntry, handleResearchChange, handleAddProjectResearch, handleProjectResearchChange,
    } = data;

    const [section, setSection] = useState<LaboratorySection>("overview");

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

    const [selectedResearchId, setSelectedResearchId] = useState<string | null>(null);
    const selectedResearch = researchEntries.find((r) => r.id === selectedResearchId) ?? null;

    const [kiwiOpen, setKiwiOpen] = useState(false);
    const kiwiChat = useKiwiChat();
    const [searchOpen, setSearchOpen] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [mindMapOpen, setMindMapOpen] = useState(false);
    const [whiteboardOpen, setWhiteboardOpen] = useState(false);

    // Both stay local rather than being lifted to App.tsx the way
    // notifications/account/calendar were: every item is already
    // persisted server-side (apps/server's content_items and
    // video_projects), so a remount refetches instead of losing work.
    const contentHub = useContentHubState();
    const videoStudio = useVideoStudioState();

    // Search and Notifications both drop down from the same top-right
    // spot — opening one closes the other so they never stack.
    const openSearch = () => { setSearchOpen(true); setNotificationsOpen(false); };
    const openNotifications = () => { setNotificationsOpen(true); setSearchOpen(false); };

    // These three wrap the data-layer's own create*() (see
    // state/laboratoryData.ts) with local navigation — selecting the
    // new item and switching section is UI behavior specific to this
    // component, not something the shared data hook should own.
    const handleCreateProject = () => {
        const project = createProject();
        setSelectedProjectId(project.id);
        setSection("projects");
    };

    const handleCreateNote = () => {
        const note = createNote();
        setSelectedNoteId(note.id);
    };

    const handleCreateResearchEntry = () => {
        const entry = createResearchEntry();
        setSelectedResearchId(entry.id);
    };

    const handleSearchSelect = (kind: "project" | "note" | "research", id: string) => {
        if (kind === "project") { setSection("projects"); setSelectedProjectId(id); }
        else if (kind === "note") { setSection("notes"); setSelectedNoteId(id); }
        else { setSection("research"); setSelectedResearchId(id); }
    };

    return (
        <div
            className={`laboratory${leaving ? " laboratory-leaving" : ""}`}
            // The wash is what keeps text over the background readable.
            // Lighter than it was: it was tuned against a starfield, and
            // at 55% it flattened the moonscape into grey card.
            style={{ backgroundImage: `linear-gradient(rgba(2,6,17,0.38), rgba(2,6,17,0.38)), ${resolveBackgroundImage(account.background)}` }}
        >
            <LaboratoryTopBar
                onBack={() => setLeaving(true)}
                listening={kiwiChat.listening}
                onOpenSearch={openSearch}
                onOpenCalendar={() => setCalendarOpen(true)}
                onOpenNotifications={openNotifications}
                unreadNotificationCount={notifications.unreadCount}
                projectCount={projects.length}
                activeProjectCount={projects.filter((p) => p.status === "active").length}
                noteCount={notes.length}
                researchCount={researchEntries.length}
                spotify={spotify}
            />

            <div className="laboratory-body">
                <LaboratorySidebar
                    section={section}
                    onSectionChange={setSection}
                    onCreateProject={handleCreateProject}
                    onOpenKiwi={() => setKiwiOpen(true)}
                />

                <main className="laboratory-main">
                    {section === "overview" && (
                        <Overview
                            projects={projects}
                            notes={notes}
                            researchEntries={researchEntries}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onCreateProject={handleCreateProject}
                            onGoToSection={setSection}
                            onSelectNote={(id) => { setSelectedNoteId(id); setSection("notes"); }}
                            onSelectResearch={(id) => { setSelectedResearchId(id); setSection("research"); }}
                            onToggleTask={handleToggleTask}
                        />
                    )}

                    {section === "tasks" && (
                        <TasksBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddTask={handleAddTask}
                            onToggleTask={handleToggleTask}
                            onRemoveTask={handleRemoveTask}
                        />
                    )}

                    {section === "ideas" && (
                        <IdeasBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddIdea={handleAddIdea}
                            onRemoveIdea={handleRemoveIdea}
                        />
                    )}

                    {section === "design" && (
                        <DesignStudioBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddDesignRef={handleAddDesignRef}
                            onRemoveDesignRef={handleRemoveDesignRef}
                        />
                    )}

                    {section === "prototypes" && (
                        <PrototypesBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddPrototype={handleAddPrototype}
                            onCyclePrototypeStage={handleCyclePrototypeStage}
                            onRemovePrototype={handleRemovePrototype}
                        />
                    )}

                    {section === "resources" && (
                        <ResourcesBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddResource={handleAddResource}
                            onRemoveResource={handleRemoveResource}
                        />
                    )}

                    {section === "tests" && (
                        <TestsBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddTest={handleAddTest}
                            onCycleTestStatus={handleCycleTestStatus}
                            onRemoveTest={handleRemoveTest}
                        />
                    )}

                    {section === "documents" && (
                        <DocumentsBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddDocument={handleAddDocument}
                            onRemoveDocument={handleRemoveDocument}
                        />
                    )}

                    {section === "products" && (
                        <ProductsBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddProduct={handleAddProduct}
                            onCycleProductStage={handleCycleProductStage}
                            onRemoveProduct={handleRemoveProduct}
                            onUpdateProductSpecs={handleUpdateProductSpecs}
                        />
                    )}

                    {section === "store" && (
                        <StoreBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddStoreChannel={handleAddStoreChannel}
                            onRemoveStoreChannel={handleRemoveStoreChannel}
                        />
                    )}

                    {section === "marketing" && (
                        <MarketingBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddMarketingItem={handleAddMarketingItem}
                            onCycleMarketingStatus={handleCycleMarketingStatus}
                            onRemoveMarketingItem={handleRemoveMarketingItem}
                        />
                    )}

                    {section === "analytics" && (
                        <AnalyticsPage projects={projects} noteCount={notes.length} researchCount={researchEntries.length} />
                    )}

                    {section === "image-generation" && (
                        <ImageGenerationBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddImagePrompt={handleAddImagePrompt}
                            onRemoveImagePrompt={handleRemoveImagePrompt}
                        />
                    )}

                    {section === "market-analysis" && (
                        <MarketAnalysisBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddMarketQuery={handleAddMarketQuery}
                            onRemoveMarketQuery={handleRemoveMarketQuery}
                        />
                    )}

                    {section === "trend-scanner" && (
                        <TrendScannerBoard
                            projects={projects}
                            onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                            onAddTrendTopic={handleAddTrendTopic}
                            onRemoveTrendTopic={handleRemoveTrendTopic}
                        />
                    )}

                    {section === "content-hub" && <ContentHubBoard contentHub={contentHub} />}

                    {section === "video-studio" && <VideoStudioBoard videoStudio={videoStudio} />}

                    {section === "projects" && (
                        selectedProject ? (
                            <ProjectWorkspace
                                project={selectedProject}
                                onBack={() => setSelectedProjectId(null)}
                                onOpenKiwi={() => setKiwiOpen(true)}
                                onChange={handleProjectChange}
                                onAddTask={handleAddTask}
                                onToggleTask={handleToggleTask}
                                onRemoveTask={handleRemoveTask}
                                onAddIdea={handleAddIdea}
                                onRemoveIdea={handleRemoveIdea}
                                onAddDesignRef={handleAddDesignRef}
                                onRemoveDesignRef={handleRemoveDesignRef}
                                onAddPrototype={handleAddPrototype}
                                onCyclePrototypeStage={handleCyclePrototypeStage}
                                onRemovePrototype={handleRemovePrototype}
                                onAddFile={handleAddFile}
                                onRemoveFile={handleRemoveFile}
                                onAddModel={handleAddModel}
                                onRemoveModel={handleRemoveModel}
                                onAddResource={handleAddResource}
                                onRemoveResource={handleRemoveResource}
                                onAddTest={handleAddTest}
                                onCycleTestStatus={handleCycleTestStatus}
                                onRemoveTest={handleRemoveTest}
                                onAddDocument={handleAddDocument}
                                onRemoveDocument={handleRemoveDocument}
                                onAddProduct={handleAddProduct}
                                onCycleProductStage={handleCycleProductStage}
                                onRemoveProduct={handleRemoveProduct}
                                onUpdateProductSpecs={handleUpdateProductSpecs}
                                onAddStoreChannel={handleAddStoreChannel}
                                onRemoveStoreChannel={handleRemoveStoreChannel}
                                onAddMarketingItem={handleAddMarketingItem}
                                onCycleMarketingStatus={handleCycleMarketingStatus}
                                onRemoveMarketingItem={handleRemoveMarketingItem}
                                onAddNote={handleAddProjectNote}
                                onNoteChange={handleProjectNoteChange}
                                onAddResearch={handleAddProjectResearch}
                                onResearchChange={handleProjectResearchChange}
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

            <LaboratoryQuickBar
                onOpenSection={setSection}
                onOpenMindMap={() => setMindMapOpen(true)}
                onOpenWhiteboard={() => setWhiteboardOpen(true)}
            />

            <KiwiPanel
                isOpen={kiwiOpen}
                onToggle={() => setKiwiOpen((open) => !open)}
                hideTab={searchOpen || calendarOpen || notificationsOpen}
                {...kiwiChat}
                project={section === "projects" ? selectedProject : null}
            />

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

            {notificationsOpen && (
                <NotificationsPanel
                    onClose={() => setNotificationsOpen(false)}
                    notifications={notifications.notifications}
                    onMarkRead={notifications.markRead}
                    onMarkAllRead={notifications.markAllRead}
                    onRemove={notifications.removeNotification}
                />
            )}

            {mindMapOpen && <MindMapView projects={projects} onClose={() => setMindMapOpen(false)} />}
            {whiteboardOpen && (
                <WhiteboardCanvas projects={projects} onClose={() => setWhiteboardOpen(false)} onAddFile={handleAddFile} />
            )}

            {/* Sunlight off the regolith as the camera lifts away — the
                same wash that brought you in, run backwards. */}
            {leaving && <div className="laboratory-leaving-glare" aria-hidden="true" />}
        </div>
    );
}
