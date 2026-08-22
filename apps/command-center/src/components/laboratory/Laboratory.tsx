import { useEffect, useState } from "react";
import LaboratoryTopBar from "./LaboratoryTopBar";
import LaboratoryQuickBar from "./LaboratoryQuickBar";
import LaboratorySearch from "./LaboratorySearch";
import CalendarPanel from "./CalendarPanel";
import NotificationsPanel from "./NotificationsPanel";
import Overview from "./Overview";
import TasksBoard from "./TasksBoard";
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
import ContentHubBoard from "./ContentHubBoard";
import NotesBoard from "./NotesBoard";
import StudioEditor from "./StudioEditor";
import ProjectsHome from "./ProjectsHome";
import StudioRail from "./StudioRail";
import ProjectDetail from "./ProjectDetail";
import { useStudioProjectsState } from "../../state/studioProjects";
import VideoStudioBoard from "./VideoStudioBoard";
import ProjectGrid from "./ProjectGrid";
import ProjectWorkspace from "./ProjectWorkspace";
import KiwiPanel from "./KiwiPanel";
import { useKiwiChat } from "../../lib/useKiwiChat";
import { resolveBackgroundImage } from "../../state/backgrounds";
import type { NotificationsState } from "../../state/notifications";
import { useContentHubState } from "../../state/contentHub";
import { useVideoStudioState } from "../../state/videoStudio";
import { useLabNotesState } from "../../state/labNotes";
import type { AccountState } from "../../state/account";
import type { CalendarState } from "../../state/calendar";
import type { LaboratoryDataState } from "../../state/laboratoryData";
import type { SpotifyState } from "../../state/spotify";
import "./Laboratory.css";

export type LaboratorySection =
    | "guide" | "overview" | "projects" | "research" | "notes"
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
        handleAddProjectNote, handleProjectNoteChange,
        handleAddProjectResearch, handleProjectResearchChange,
    } = data;

    // The Guide is the landing screen: opening the Laboratory on a page
    // that says where you are beats opening on one of twenty sections
    // with no indication of which one you wanted.
    const [section, setSection] = useState<LaboratorySection>("guide");

    // Which project the Guide (and the sidebar's phase markers) are
    // reading. Falls back to the first project so there's always
    // something to follow; null only when there are no projects at all.
    // Which video is open in Video Studio. Held here because the
    // pipeline board on the Guide page opens one directly — the board
    // itself shouldn't have to be told after the fact.
    const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

    const [editingVideoId, setEditingVideoId] = useState<number | null>(null);

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;



    const [kiwiOpen, setKiwiOpen] = useState(false);
    const kiwiChat = useKiwiChat();
    const [searchOpen, setSearchOpen] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    // Both stay local rather than being lifted to App.tsx the way
    // notifications/account/calendar were: every item is already
    // persisted server-side (apps/server's content_items and
    // video_projects), so a remount refetches instead of losing work.
    const contentHub = useContentHubState();
    const videoStudio = useVideoStudioState();
    // The cut takes the whole window — no sidebar, no quick bar, no page
    // padding. It is a different room, not another panel, so it replaces
    // the Laboratory's body rather than rendering inside it.

    // Which of the four stages the studio is showing, and which video
    // the last three are about. PROJECTS is the only one that means
    // anything without a video picked.
    // Projects own everything now: a project holds its ideas and its
    // videos, and the cut and the publish are reached from a video
    // inside one. There is one way in.
    const studioProjects = useStudioProjectsState();
    const [openProjectId, setOpenProjectId] = useState<number | null>(null);
    // Publish is a page about one video, reached from inside a project.


    // The overview rail. Collapsing it is remembered, because it is a
    // standing preference about how much room you want the work to
    // have — not a per-visit decision.
    const [railCollapsed, setRailCollapsed] = useState(
        () => localStorage.getItem("kiwi.studio.rail") === "collapsed",
    );
    const toggleRail = () => setRailCollapsed((was) => {
        localStorage.setItem("kiwi.studio.rail", was ? "open" : "collapsed");
        return !was;
    });
    const openProject = studioProjects.projects.find((p) => p.id === openProjectId) ?? null;
    /**
     * Videos arrive from two places: videoStudio's own list, and inside
     * whichever project is open. A video created in a project isn't in
     * the first until it refetches, which is why Publish opened onto
     * nothing — so both are consulted, videoStudio first because its
     * copy carries the live transcription state.
     */
    const findVideo = (id: number | null) => id === null ? null
        : videoStudio.projects.find((p) => p.id === id)
        ?? studioProjects.projects.flatMap((p) => p.videos).find((v) => v.id === id)
        ?? null;


    const editingVideo = findVideo(editingVideoId);




    // Ideas / trends / research / notes, server-backed since Sprint 091
    // — same reasoning as the two above: persisted, so a remount
    // refetches rather than losing what you wrote.
    const labNotes = useLabNotesState();

    // Search and Notifications both drop down from the same top-right
    // spot — opening one closes the other so they never stack.
    const openSearch = () => { setSearchOpen(true); setNotificationsOpen(false); };
    const openNotifications = () => { setNotificationsOpen(true); setSearchOpen(false); };

    // These three wrap the data-layer's own create*() (see
    // state/laboratoryData.ts) with local navigation — selecting the
    // new item and switching section is UI behavior specific to this
    // component, not something the shared data hook should own.
    /**
     * Moves a loose video into a project.
     *
     * Both lists have to be re-read: the video's own row changed, and
     * the project it moved into now has one more. Refreshing only the
     * one you touched leaves the other saying what it said a moment ago.
     */
    const handleAssignVideo = (videoId: number, projectId: number) => {
        void videoStudio.update(videoId, { projectId }).then(() => studioProjects.refresh());
    };

    const handleCreateProject = () => {
        const project = createProject();
        setSelectedProjectId(project.id);
        setSection("projects");
    };



    const handleSearchSelect = (kind: "project" | "note" | "research", id: string) => {
        // Notes and research are one flat list now rather than a grid
        // you walk into, so there's no single item to select — the
        // section itself is the destination.
        if (kind === "project") { setSection("projects"); setSelectedProjectId(id); }
        else if (kind === "note") setSection("notes");
        else setSection("research");
    };

    return (
        <div
            className={`laboratory${leaving ? " laboratory-leaving" : ""}`}
            // The wash is what keeps text over the background readable.
            // It was 38%, tuned to let the moonscape read clearly — but
            // this is a workspace now, and terrain showing through the
            // panels competed with the work on them. The moon stays;
            // it just sits further back.
            style={{ backgroundImage: `linear-gradient(rgba(2,6,17,0.72), rgba(2,6,17,0.72)), ${resolveBackgroundImage(account.background)}` }}
        >
            <LaboratoryTopBar
                onBack={() => setLeaving(true)}
                listening={kiwiChat.listening}
                onOpenSearch={openSearch}
                onOpenCalendar={() => setCalendarOpen(true)}
                onOpenNotifications={openNotifications}
                unreadNotificationCount={notifications.unreadCount}
                projectCount={studioProjects.projects.length}
                atProjects={openProjectId === null && editingVideoId === null}
                onGoToProjects={() => {
                    // Both have to be cleared: the render checks the
                    // open project before the projects list, so leaving
                    // either set makes the button look broken rather
                    // than do nothing.
                    setOpenProjectId(null);
                    setEditingVideoId(null);
                    setSection("guide");
                }}
                spotify={spotify}
            />

            {editingVideo ? (
                <StudioEditor
                    // Keyed so opening a different video is a fresh
                    // editor rather than the old one handed a new
                    // project — the cut it is holding belongs to the
                    // video it was opened on, and it saves it.
                    key={editingVideo.id}
                    project={editingVideo}
                    owner={studioProjects.projects.find((p) => p.videos.some((v) => v.id === editingVideo.id)) ?? null}
                    onBack={() => setEditingVideoId(null)}
                />
            ) : (
                <>
                <div className="laboratory-body">
                    {/* Beside the work, on every screen. It used to be
                        the header of Projects, which is the one screen
                        where you are least likely to want it — you ask
                        "how is this going" while you are in the middle
                        of something. */}
                    <StudioRail
                        projects={studioProjects.projects}
                        videos={videoStudio.projects}
                        collapsed={railCollapsed}
                        onToggle={toggleRail}
                    />
                    {/* No rail. Everything that was on it — ideas,
                        research, posts — belongs to a project, and a
                        second way to reach half of it was most of what
                        made this hard to hold in your head. */}
                    <main className="laboratory-main">
                        {section === "overview" && (
                            <Overview
                                projects={projects}
                                notes={notes}
                                researchEntries={researchEntries}
                                onSelectProject={(id) => { setSelectedProjectId(id); setSection("projects"); }}
                                onCreateProject={handleCreateProject}
                                onGoToSection={setSection}
                                onSelectNote={() => setSection("notes")}
                                onSelectResearch={() => setSection("research")}
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

                        {section === "ideas" && <NotesBoard kind="idea" notes={labNotes} />}

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

                        {section === "trend-scanner" && <NotesBoard kind="trend" notes={labNotes} />}

                        {section === "guide" && (
                            openProject ? (
                                <ProjectDetail
                                    project={openProject}
                                    projects={studioProjects}
                                    videoStudio={videoStudio}
                                    onVideosChanged={videoStudio.refresh}
                                    onBack={() => setOpenProjectId(null)}
                                    onEdit={(id) => { setSelectedVideoId(id); setEditingVideoId(id); }}
                                />
                            ) : (
                                <ProjectsHome
                                    projects={studioProjects}
                                    videos={videoStudio.projects}
                                    onOpen={setOpenProjectId}
                                    onAssignVideo={handleAssignVideo}
                                />
                            )
                        )}

                        {section === "content-hub" && <ContentHubBoard contentHub={contentHub} />}

                        {section === "video-studio" && (
                            <VideoStudioBoard
                                videoStudio={videoStudio}
                                selectedId={selectedVideoId}
                                onSelect={setSelectedVideoId}
                                onOpenEditor={setEditingVideoId}
                            />
                        )}

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

                        {section === "research" && <NotesBoard kind="research" notes={labNotes} />}

                        {section === "notes" && <NotesBoard kind="note" notes={labNotes} />}
                    </main>
                </div>

                <LaboratoryQuickBar />
                </>
            )}

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


            {/* Sunlight off the regolith as the camera lifts away — the
                same wash that brought you in, run backwards. */}
            {leaving && <div className="laboratory-leaving-glare" aria-hidden="true" />}
        </div>
    );
}
