import { useState } from "react";
import {
    MOCK_PROJECTS, PROTOTYPE_STAGE_ORDER, TEST_STATUS_ORDER, PRODUCT_STAGE_ORDER, MARKETING_STATUS_ORDER,
    createMockProject, type LaboratoryProject, type ImageAttachment,
} from "./laboratoryProjects";
import { MOCK_NOTES, createMockNote, type LabNote } from "./laboratoryNotes";
import { MOCK_RESEARCH, createMockResearchEntry, type ResearchEntry } from "./laboratoryResearch";

export interface LaboratoryDataState {
    projects: LaboratoryProject[];
    notes: LabNote[];
    researchEntries: ResearchEntry[];
    createProject: () => LaboratoryProject;
    handleProjectChange: (id: string, changes: Partial<Pick<LaboratoryProject, "name" | "category" | "description">>) => void;
    handleAddTask: (projectId: string, title: string) => void;
    handleToggleTask: (projectId: string, taskId: string) => void;
    handleRemoveTask: (projectId: string, taskId: string) => void;
    handleAddIdea: (projectId: string, text: string) => void;
    handleRemoveIdea: (projectId: string, ideaId: string) => void;
    handleAddDesignRef: (projectId: string, label: string, url: string, image?: ImageAttachment) => void;
    handleRemoveDesignRef: (projectId: string, refId: string) => void;
    handleAddPrototype: (projectId: string, label: string, url: string) => void;
    handleCyclePrototypeStage: (projectId: string, prototypeId: string) => void;
    handleRemovePrototype: (projectId: string, prototypeId: string) => void;
    handleAddFile: (projectId: string, name: string, image?: ImageAttachment) => void;
    handleRemoveFile: (projectId: string, fileId: string) => void;
    handleAddModel: (projectId: string, name: string, blobUrl: string) => string;
    handleRemoveModel: (projectId: string, modelId: string) => void;
    handleAddResource: (projectId: string, label: string, url: string) => void;
    handleRemoveResource: (projectId: string, resourceId: string) => void;
    handleAddTest: (projectId: string, title: string) => void;
    handleCycleTestStatus: (projectId: string, testId: string) => void;
    handleRemoveTest: (projectId: string, testId: string) => void;
    handleAddDocument: (projectId: string, label: string, url: string) => void;
    handleRemoveDocument: (projectId: string, documentId: string) => void;
    handleAddProduct: (projectId: string, name: string, price: string) => void;
    handleUpdateProductSpecs: (projectId: string, productId: string, specs: string) => void;
    handleCycleProductStage: (projectId: string, productId: string) => void;
    handleRemoveProduct: (projectId: string, productId: string) => void;
    handleAddStoreChannel: (projectId: string, label: string, url: string) => void;
    handleRemoveStoreChannel: (projectId: string, channelId: string) => void;
    handleAddMarketingItem: (projectId: string, label: string) => void;
    handleCycleMarketingStatus: (projectId: string, itemId: string) => void;
    handleRemoveMarketingItem: (projectId: string, itemId: string) => void;
    handleAddImagePrompt: (projectId: string, prompt: string) => void;
    handleRemoveImagePrompt: (projectId: string, promptId: string) => void;
    handleAddMarketQuery: (projectId: string, query: string) => void;
    handleRemoveMarketQuery: (projectId: string, queryId: string) => void;
    handleAddTrendTopic: (projectId: string, topic: string) => void;
    handleRemoveTrendTopic: (projectId: string, topicId: string) => void;
    createNote: () => LabNote;
    handleNoteChange: (id: string, changes: Partial<Pick<LabNote, "title" | "content">>) => void;
    handleAddProjectNote: (projectId: string) => string;
    handleProjectNoteChange: (projectId: string, noteId: string, changes: Partial<Pick<LabNote, "title" | "content">>) => void;
    createResearchEntry: () => ResearchEntry;
    handleResearchChange: (id: string, changes: Partial<Pick<ResearchEntry, "title" | "summary" | "tag" | "source">>) => void;
    handleAddProjectResearch: (projectId: string) => string;
    handleProjectResearchChange: (projectId: string, entryId: string, changes: Partial<Pick<ResearchEntry, "title" | "summary" | "tag" | "source">>) => void;
}

/**
 * Laboratory's own project/notes/research registry — owned by App.tsx
 * (same pattern as useAccountState/useCalendarState) so the Dashboard's
 * Notes/Projects widgets can read the exact same data Laboratory
 * itself edits, rather than a second copy that resets whenever
 * Laboratory unmounts. Laboratory.tsx still owns all UI-only state
 * (which section/item is open, search/calendar/notifications panels)
 * — only the actual data and its mutations live here. The three
 * "create" actions return the new entity (rather than also picking it)
 * so each caller can decide its own follow-up UI behavior (Laboratory
 * selects it and switches section; nothing else currently calls these).
 */
export function useLaboratoryDataState(): LaboratoryDataState {
    const [projects, setProjects] = useState<LaboratoryProject[]>(MOCK_PROJECTS);
    const [notes, setNotes] = useState<LabNote[]>(MOCK_NOTES);
    const [researchEntries, setResearchEntries] = useState<ResearchEntry[]>(MOCK_RESEARCH);

    const createProject = (): LaboratoryProject => {
        const project = createMockProject();
        setProjects((prev) => [project, ...prev]);
        return project;
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

    // Returns the new model's id so Model3DViewer can select it
    // immediately, same "return the id" convention as
    // handleAddProjectNote/handleAddProjectResearch.
    const handleAddModel = (projectId: string, name: string, blobUrl: string): string => {
        const id = `model-${Date.now()}`;
        setProjects((prev) => prev.map((p) => (
            p.id === projectId
                ? { ...p, models: [...p.models, { id, name, blobUrl }], lastActivity: "Just now" }
                : p
        )));
        return id;
    };

    const handleRemoveModel = (projectId: string, modelId: string) => {
        setProjects((prev) => prev.map((p) => {
            if (p.id !== projectId) return p;
            const removed = p.models.find((m) => m.id === modelId);
            if (removed) URL.revokeObjectURL(removed.blobUrl);
            return { ...p, models: p.models.filter((m) => m.id !== modelId) };
        }));
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

    const createNote = (): LabNote => {
        const note = createMockNote();
        setNotes((prev) => [note, ...prev]);
        return note;
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

    const createResearchEntry = (): ResearchEntry => {
        const entry = createMockResearchEntry();
        setResearchEntries((prev) => [entry, ...prev]);
        return entry;
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

    return {
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
    };
}
