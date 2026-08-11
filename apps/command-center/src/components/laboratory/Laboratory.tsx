import { useState, type MouseEvent } from "react";
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
import MindMapView from "./MindMapView";
import WhiteboardCanvas from "./WhiteboardCanvas";
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
import {
    MOCK_PROJECTS, PROTOTYPE_STAGE_ORDER, TEST_STATUS_ORDER, PRODUCT_STAGE_ORDER, MARKETING_STATUS_ORDER,
    createMockProject, type LaboratoryProject, type ImageAttachment,
} from "../../state/laboratoryProjects";
import { MOCK_NOTES, createMockNote, type LabNote } from "../../state/laboratoryNotes";
import { MOCK_RESEARCH, createMockResearchEntry, type ResearchEntry } from "../../state/laboratoryResearch";
import { resolveBackgroundImage } from "../../state/backgrounds";
import { useNotificationsState } from "../../state/notifications";
import type { AccountState } from "../../state/account";
import type { CalendarState } from "../../state/calendar";
import "./Laboratory.css";

export type LaboratorySection =
    | "overview" | "projects" | "research" | "notes"
    | "tasks" | "ideas" | "design" | "prototypes"
    | "resources" | "tests" | "documents"
    | "products" | "store" | "marketing" | "analytics"
    | "image-generation" | "market-analysis" | "trend-scanner";

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
    const [section, setSection] = useState<LaboratorySection>("overview");

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
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [mindMapOpen, setMindMapOpen] = useState(false);
    const [whiteboardOpen, setWhiteboardOpen] = useState(false);
    const notifications = useNotificationsState();

    // Search and Notifications both drop down from the same top-right
    // spot — opening one closes the other so they never stack.
    const openSearch = () => { setSearchOpen(true); setNotificationsOpen(false); };
    const openNotifications = () => { setNotificationsOpen(true); setSearchOpen(false); };

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

    const handleAddIdea = (projectId: string, text: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, ideas: [...p.ideas, { id: `idea-${Date.now()}`, text }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveIdea = (projectId: string, ideaId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, ideas: p.ideas.filter((i) => i.id !== ideaId) }
                : p
        )));
    };

    const handleAddDesignRef = (projectId: string, label: string, url: string, image?: ImageAttachment) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, designRefs: [...p.designRefs, { id: `design-${Date.now()}`, label, url, image }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveDesignRef = (projectId: string, refId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, designRefs: p.designRefs.filter((r) => r.id !== refId) }
                : p
        )));
    };

    const handleAddPrototype = (projectId: string, label: string, url: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, prototypes: [...p.prototypes, { id: `proto-${Date.now()}`, label, url, stage: "planned" }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleCyclePrototypeStage = (projectId: string, prototypeId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? {
                    ...p,
                    prototypes: p.prototypes.map((proto) => {
                        if (proto.id !== prototypeId) return proto;
                        const nextIndex = (PROTOTYPE_STAGE_ORDER.indexOf(proto.stage) + 1) % PROTOTYPE_STAGE_ORDER.length;
                        return { ...proto, stage: PROTOTYPE_STAGE_ORDER[nextIndex] };
                    }),
                    lastActivity: "Just now",
                }
                : p
        )));
    };

    const handleRemovePrototype = (projectId: string, prototypeId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, prototypes: p.prototypes.filter((proto) => proto.id !== prototypeId) }
                : p
        )));
    };

    const handleAddFile = (projectId: string, name: string, image?: ImageAttachment) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, files: [...p.files, { id: `file-${Date.now()}`, name, image }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveFile = (projectId: string, fileId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, files: p.files.filter((f) => f.id !== fileId) }
                : p
        )));
    };

    const handleAddResource = (projectId: string, label: string, url: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, resources: [...p.resources, { id: `resource-${Date.now()}`, label, url }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveResource = (projectId: string, resourceId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, resources: p.resources.filter((r) => r.id !== resourceId) }
                : p
        )));
    };

    const handleAddTest = (projectId: string, title: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, tests: [...p.tests, { id: `test-${Date.now()}`, title, status: "untested" }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleCycleTestStatus = (projectId: string, testId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? {
                    ...p,
                    tests: p.tests.map((test) => {
                        if (test.id !== testId) return test;
                        const nextIndex = (TEST_STATUS_ORDER.indexOf(test.status) + 1) % TEST_STATUS_ORDER.length;
                        return { ...test, status: TEST_STATUS_ORDER[nextIndex] };
                    }),
                    lastActivity: "Just now",
                }
                : p
        )));
    };

    const handleRemoveTest = (projectId: string, testId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, tests: p.tests.filter((t) => t.id !== testId) }
                : p
        )));
    };

    const handleAddDocument = (projectId: string, label: string, url: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, documents: [...p.documents, { id: `document-${Date.now()}`, label, url }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveDocument = (projectId: string, documentId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, documents: p.documents.filter((d) => d.id !== documentId) }
                : p
        )));
    };

    const handleAddProduct = (projectId: string, name: string, price: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, products: [...p.products, { id: `product-${Date.now()}`, name, price, stage: "idea", specs: "" }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleUpdateProductSpecs = (projectId: string, productId: string, specs: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, products: p.products.map((product) => (product.id === productId ? { ...product, specs } : product)) }
                : p
        )));
    };

    const handleCycleProductStage = (projectId: string, productId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? {
                    ...p,
                    products: p.products.map((product) => {
                        if (product.id !== productId) return product;
                        const nextIndex = (PRODUCT_STAGE_ORDER.indexOf(product.stage) + 1) % PRODUCT_STAGE_ORDER.length;
                        return { ...product, stage: PRODUCT_STAGE_ORDER[nextIndex] };
                    }),
                    lastActivity: "Just now",
                }
                : p
        )));
    };

    const handleRemoveProduct = (projectId: string, productId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, products: p.products.filter((prod) => prod.id !== productId) }
                : p
        )));
    };

    const handleAddStoreChannel = (projectId: string, label: string, url: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, storeChannels: [...p.storeChannels, { id: `store-${Date.now()}`, label, url }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveStoreChannel = (projectId: string, channelId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, storeChannels: p.storeChannels.filter((c) => c.id !== channelId) }
                : p
        )));
    };

    const handleAddMarketingItem = (projectId: string, label: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, marketing: [...p.marketing, { id: `marketing-${Date.now()}`, label, status: "planned" }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleCycleMarketingStatus = (projectId: string, itemId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? {
                    ...p,
                    marketing: p.marketing.map((item) => {
                        if (item.id !== itemId) return item;
                        const nextIndex = (MARKETING_STATUS_ORDER.indexOf(item.status) + 1) % MARKETING_STATUS_ORDER.length;
                        return { ...item, status: MARKETING_STATUS_ORDER[nextIndex] };
                    }),
                    lastActivity: "Just now",
                }
                : p
        )));
    };

    const handleRemoveMarketingItem = (projectId: string, itemId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, marketing: p.marketing.filter((item) => item.id !== itemId) }
                : p
        )));
    };

    const handleAddImagePrompt = (projectId: string, prompt: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, imagePrompts: [...p.imagePrompts, { id: `image-prompt-${Date.now()}`, prompt }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveImagePrompt = (projectId: string, promptId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, imagePrompts: p.imagePrompts.filter((item) => item.id !== promptId) }
                : p
        )));
    };

    const handleAddMarketQuery = (projectId: string, query: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, marketQueries: [...p.marketQueries, { id: `market-query-${Date.now()}`, query }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveMarketQuery = (projectId: string, queryId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, marketQueries: p.marketQueries.filter((item) => item.id !== queryId) }
                : p
        )));
    };

    const handleAddTrendTopic = (projectId: string, topic: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, trendTopics: [...p.trendTopics, { id: `trend-topic-${Date.now()}`, topic }], lastActivity: "Just now" }
                : p
        )));
    };

    const handleRemoveTrendTopic = (projectId: string, topicId: string) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, trendTopics: p.trendTopics.filter((item) => item.id !== topicId) }
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

    // Same "generate before setProjects, return the id synchronously"
    // approach as handleAddProjectNote.
    const handleAddProjectResearch = (projectId: string): string => {
        const entry = createMockResearchEntry();
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, research: [entry, ...p.research] } : p)));
        return entry.id;
    };

    const handleProjectResearchChange = (projectId: string, entryId: string, changes: Partial<Pick<ResearchEntry, "title" | "summary" | "tag" | "source">>) => {
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, research: p.research.map((r) => (r.id === entryId ? { ...r, ...changes, savedAt: "Just now" } : r)) }
                : p
        )));
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
                onOpenSearch={openSearch}
                onOpenCalendar={() => setCalendarOpen(true)}
                onOpenNotifications={openNotifications}
                unreadNotificationCount={notifications.unreadCount}
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

            <DetailDrawer content={profileDetail} onClose={() => setProfileAnchor(null)} />
        </div>
    );
}
