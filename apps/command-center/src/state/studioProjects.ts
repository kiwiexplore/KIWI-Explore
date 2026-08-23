import { useCallback, useEffect, useState } from "react";
import {
    createProject, deleteProject, fetchProjects, updateProject, type StudioProject,
} from "../lib/projectsApi";

export interface StudioProjectsState {
    projects: StudioProject[];
    loading: boolean;
    error: string | null;
    /** Re-reads everything. Called after anything inside a project changes. */
    refresh: () => void;
    create: (title: string) => Promise<StudioProject | null>;
    update: (id: number, changes: { title?: string; description?: string }) => void;
    remove: (id: number, withFolder?: boolean) => Promise<void>;
}

/**
 * The studio's projects, each already carrying its videos and ideas.
 *
 * One fetch rather than three: every screen wants the project, its
 * videos and its ideas together, and separate requests can disagree
 * about what exists. The cost is that anything changing a video or a
 * note has to call refresh() — which is the honest trade, because those
 * changes are rare and always deliberate.
 */
export function useStudioProjectsState(): StudioProjectsState {
    const [projects, setProjects] = useState<StudioProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const report = useCallback((e: unknown, fallback: string) => {
        setError(e instanceof Error ? e.message : fallback);
    }, []);

    const load = useCallback(() => {
        fetchProjects()
            .then(setProjects)
            .catch((e) => report(e, "Could not load your projects."))
            .finally(() => setLoading(false));
    }, [report]);

    useEffect(() => {
        let cancelled = false;
        fetchProjects()
            .then((found) => { if (!cancelled) setProjects(found); })
            .catch((e) => { if (!cancelled) report(e, "Could not load your projects."); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [report]);

    return {
        projects,
        loading,
        error,
        refresh: load,
        create: async (title) => {
            setError(null);
            try {
                const project = await createProject(title);
                setProjects((prev) => [project, ...prev]);
                return project;
            } catch (e) {
                report(e, "Could not create the project.");
                return null;
            }
        },
        update: (id, changes) => {
            setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
            updateProject(id, changes)
                .then((project) => setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p))))
                .catch((e) => report(e, "Could not save that change."));
        },
        remove: async (id, withFolder = false) => {
            // Awaited rather than optimistic: moving a folder to the
            // Trash can fail, and a project that vanished from the
            // screen while its files stayed would be a lie the app
            // could not take back.
            setError(null);
            try {
                await deleteProject(id, withFolder);
                setProjects((prev) => prev.filter((p) => p.id !== id));
            } catch (e) {
                report(e, "Could not delete that project.");
                throw e;
            }
        },
    };
}
