import { useCallback, useEffect, useRef, useState } from "react";
import {
    createVideoProject, deleteVideoProject, fetchVideoProjects, findVideoClips,
    generateDerivedContent, generateVideoScript, startTranscription, updateVideoProject,
    VideoNotConfiguredError, VideoStepBlockedError,
    type DerivedContentType, type VideoProject, type VideoProjectUpdate,
} from "../lib/videoApi";

/**
 * Video Studio's state. Local to Laboratory.tsx rather than lifted to
 * App.tsx, same reasoning as state/contentHub.ts: every project lives in
 * apps/server's video_projects table, so a remount refetches instead of
 * losing anything.
 *
 * The one thing this owns beyond a fetch cache is the poll while a
 * transcription runs — see below.
 */

/** Which long-running action, if any, is in flight for a project. */
export type VideoBusyAction = "script" | "transcribe" | "clips" | "content";

export interface VideoStudioState {
    projects: VideoProject[];
    loading: boolean;
    error: string | null;
    /** Distinguishes "you still have to set this up" from a real failure. */
    setupNeeded: boolean;
    busy: Record<number, VideoBusyAction | undefined>;
    dismissError: () => void;
    create: (title: string) => Promise<VideoProject | null>;
    update: (id: number, changes: VideoProjectUpdate) => void;
    remove: (id: number) => void;
    draftScript: (id: number, brief: string) => void;
    transcribe: (id: number) => void;
    findClips: (id: number) => void;
    generateContent: (id: number, type: DerivedContentType) => void;
}

// While anything is transcribing there's no push channel to learn it
// finished — whisper runs in the server process and the row just
// changes underneath us. Three seconds is frequent enough that a short
// clip doesn't sit "processing" long after it's done, and the poll stops
// completely the moment nothing is running.
const POLL_MS = 3000;

export function useVideoStudioState(): VideoStudioState {
    const [projects, setProjects] = useState<VideoProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [setupNeeded, setSetupNeeded] = useState(false);
    const [busy, setBusy] = useState<Record<number, VideoBusyAction | undefined>>({});

    const reportError = useCallback((e: unknown, fallback: string) => {
        setSetupNeeded(e instanceof VideoNotConfiguredError);
        if (e instanceof VideoNotConfiguredError || e instanceof VideoStepBlockedError) setError(e.message);
        else setError(e instanceof Error ? e.message : fallback);
    }, []);

    const replaceProject = useCallback((updated: VideoProject) => {
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }, []);

    const load = useCallback(async () => {
        const found = await fetchVideoProjects();
        setProjects(found);
        return found;
    }, []);

    // Calls the API function rather than load() so the state update
    // stays inside the promise callback — same shape as
    // state/contentHub.ts's own initial fetch.
    useEffect(() => {
        let cancelled = false;
        fetchVideoProjects()
            .then((found) => { if (!cancelled) setProjects(found); })
            .catch((e) => { if (!cancelled) reportError(e, "Could not load video projects."); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [reportError]);

    // `transcribing` (a live job in the server process) rather than
    // transcript_status === "processing": a row left over from a crash
    // reads as processing but has nothing behind it, and polling for it
    // would never end. The server sweeps those into "failed" at boot.
    const anyTranscribing = projects.some((p) => p.transcribing);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!anyTranscribing) return;
        pollRef.current = setInterval(() => {
            // A failed poll is not worth surfacing — the next one is
            // three seconds away, and the transcript state is still
            // whatever it was.
            load().catch(() => { /* keep polling */ });
        }, POLL_MS);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
        };
    }, [anyTranscribing, load]);

    // Wraps an action so exactly one long-running thing per project can
    // be in flight, and so `busy` always clears — including on failure,
    // which is what keeps a spinner from outliving the request.
    const run = useCallback(async (id: number, action: VideoBusyAction, work: () => Promise<VideoProject>, fallback: string) => {
        setError(null);
        setBusy((prev) => ({ ...prev, [id]: action }));
        try {
            replaceProject(await work());
        } catch (e) {
            reportError(e, fallback);
            // The server may have changed the row before failing (a
            // transcription that started and then died), so refetch
            // rather than trusting local state.
            await load().catch(() => { /* the error above is the one that matters */ });
        } finally {
            setBusy((prev) => ({ ...prev, [id]: undefined }));
        }
    }, [replaceProject, reportError, load]);

    const create = async (title: string): Promise<VideoProject | null> => {
        setError(null);
        try {
            const project = await createVideoProject(title);
            setProjects((prev) => [project, ...prev]);
            return project;
        } catch (e) {
            reportError(e, "Could not create the project.");
            return null;
        }
    };

    const update = (id: number, changes: VideoProjectUpdate) => {
        setError(null);
        // Optimistic — the stage picker and the path field should feel
        // immediate. The response replaces this with the server's own
        // version, and a failure refetches rather than leaving the
        // optimistic value standing.
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } as VideoProject : p)));
        updateVideoProject(id, changes)
            .then(replaceProject)
            .catch((e) => {
                reportError(e, "Could not save that change.");
                void load().catch(() => { /* error already reported */ });
            });
    };

    const remove = (id: number) => {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        deleteVideoProject(id).catch(() => { /* local state already reflects it */ });
    };

    return {
        projects,
        loading,
        error,
        setupNeeded,
        busy,
        dismissError: () => { setError(null); setSetupNeeded(false); },
        create,
        update,
        remove,
        draftScript: (id, brief) => void run(id, "script", () => generateVideoScript(id, brief), "Could not draft a script."),
        transcribe: (id) => void run(id, "transcribe", () => startTranscription(id), "Could not start the transcription."),
        findClips: (id) => void run(id, "clips", () => findVideoClips(id), "Could not find clips."),
        generateContent: (id, type) => void run(id, "content", () => generateDerivedContent(id, type), "Could not generate that piece."),
    };
}
