import type { StudioProject } from "../lib/projectsApi";
import type { VideoProject } from "../lib/videoApi";

/**
 * The four phases a video goes through, and what each one is waiting on.
 *
 * This is NOT a second opinion about video_projects.stage — that column
 * still records where a video says it is, and state/videoPipeline.ts
 * still reads it. This answers a different question: what has actually
 * been DONE, measured from the work itself rather than from a label
 * somebody set.
 *
 * Every gate below is a fact that can be checked:
 *
 *   CREATE    a script exists for this video
 *   GENERATE  the project's folder has footage in it (AI track only)
 *   EDIT      a rendered file is on disk, in the project's Exports
 *   PUBLISH   the video is marked published
 *
 * That is deliberately stricter than the stage strip this replaces,
 * which coloured a step green because it was behind you. A chain whose
 * links can be ticked without doing the work is decoration. The one
 * thing it does NOT do is lock: every phase stays reachable, and an
 * unmet gate says what is missing instead of refusing.
 */

export type ChainStage = "create" | "generate" | "edit" | "publish";

export interface ChainStep {
    stage: ChainStage;
    label: string;
    /**
     * False for GENERATE on shot footage. Kept in the list rather than
     * filtered out, so the chain reads the same length everywhere and
     * the missing step is visibly not needed rather than absent.
     */
    applies: boolean;
    done: boolean;
    /** What is missing, in words. Null once the gate is met. */
    blocker: string | null;
}

export interface Chain {
    steps: ChainStep[];
    /** The first step that isn't done — where the work actually is. */
    current: ChainStep;
    /** How many of the steps that apply are done. */
    done: number;
    total: number;
}

function hasScript(video: VideoProject): boolean {
    return video.contentItems.some((item) => item.type === "youtube-script");
}

/**
 * Footage to work with. On the AI track this is what generation is for;
 * the folder is the same place either way, which is why one check
 * covers both and why an AI video whose clips you dropped in by hand
 * counts as generated. It was — just not by us.
 */
function hasFootage(owner: StudioProject | null): boolean {
    return (owner?.files ?? []).some((f) => f.kind === "video" || f.kind === "image");
}

export function chainFor(video: VideoProject, owner: StudioProject | null): Chain {
    const ai = video.track === "ai";

    const steps: ChainStep[] = [
        {
            stage: "create",
            label: "Create",
            applies: true,
            done: hasScript(video),
            blocker: hasScript(video) ? null : "no script yet",
        },
        {
            stage: "generate",
            label: "Generate",
            applies: ai,
            // A shot video has nothing to generate, so this link is
            // satisfied by not applying — otherwise every shot video
            // would sit forever one step from the end.
            done: !ai || hasFootage(owner),
            blocker: !ai ? null : hasFootage(owner) ? null : "nothing in the project's folder",
        },
        {
            stage: "edit",
            label: "Edit",
            applies: true,
            done: video.exported,
            blocker: video.exported ? null : "nothing exported yet",
        },
        {
            stage: "publish",
            label: "Publish",
            applies: true,
            done: video.stage === "published",
            blocker: video.stage === "published" ? null : "not marked published",
        },
    ];

    const applicable = steps.filter((s) => s.applies);
    return {
        steps,
        current: applicable.find((s) => !s.done) ?? applicable[applicable.length - 1],
        done: applicable.filter((s) => s.done).length,
        total: applicable.length,
    };
}

/**
 * The one sentence to put under a video's title.
 *
 * A failed transcript overrides the chain: it is the only state where
 * something went wrong rather than simply not having happened, and
 * burying that under "no script yet" is how a failure goes unnoticed.
 */
export function chainSummary(video: VideoProject, owner: StudioProject | null): string {
    if (video.transcriptStatus === "failed") return "Transcription failed — read the error and run it again.";
    const chain = chainFor(video, owner);
    if (chain.current.done) return "Done. Nothing pending.";
    return `${chain.current.label} — ${chain.current.blocker}`;
}
