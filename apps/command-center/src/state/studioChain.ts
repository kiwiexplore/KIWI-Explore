import type { LabNote } from "../lib/notesApi";
import type { VideoProject } from "../lib/videoApi";

/**
 * The three phases a video goes through, and how far each one has got.
 *
 * This is NOT a second opinion about video_projects.stage — that column
 * still records where a video says it is, and state/videoPipeline.ts
 * still reads it. This answers a different question: what has actually
 * been DONE, measured from the work rather than from a label somebody
 * set.
 *
 * Each phase has three states rather than two, because "not finished"
 * covers two situations that feel nothing alike — nothing written at
 * all, and a draft sitting there waiting to be called finished:
 *
 *   todo   nothing yet
 *   doing  something exists but hasn't been ticked
 *   done   ticked, or a fact on disk says so
 *
 * The line between doing and done is deliberately a TICK you press,
 * everywhere it can be. A script that exists is work started; a script
 * you have ticked is work finished. Deriving "done" from existence
 * would call CREATE finished the moment you typed a title.
 *
 * The one exception is EDIT, where done means a rendered file is on
 * disk. That is a fact nobody can tick without doing the work, which
 * makes it better than a tick rather than worse.
 */

export type ChainStage = "create" | "edit" | "publish";
export type ChainState = "todo" | "doing" | "done";

export interface ChainStep {
    stage: ChainStage;
    label: string;
    state: ChainState;
    /** What would move it on from here. Null once it is done. */
    next: string | null;
}

export interface Chain {
    steps: ChainStep[];
    /** The first step that isn't done — where the work actually is. */
    current: ChainStep;
    done: number;
    total: number;
}

export interface ChainInput {
    video: VideoProject;
    /** The ideas written for THIS video, not the whole project. */
    ideas: LabNote[];
}

function createState(input: ChainInput): { state: ChainState; next: string | null } {
    const scripts = input.video.contentItems.filter((i) => i.type === "youtube-script");
    const started = [...scripts, ...input.ideas];

    if (started.length === 0) return { state: "todo", next: "write an idea or a script" };

    // Every piece of writing for this video has to be ticked. Half a
    // script and three loose ideas is not a finished brief, and calling
    // it one is how the chain stops meaning anything.
    const left = started.filter((i) => !i.done).length;
    if (left > 0) return { state: "doing", next: `${left} still to tick off` };

    return { state: "done", next: null };
}

function editState(video: VideoProject): { state: ChainState; next: string | null } {
    if (video.exported) return { state: "done", next: null };

    const stored = video.timeline as { clips?: unknown[] } | null;
    const clips = stored && Array.isArray(stored.clips) ? stored.clips.length : 0;
    if (clips > 0) return { state: "doing", next: "export it" };

    return { state: "todo", next: "put something on the timeline" };
}

function publishState(video: VideoProject): { state: ChainState; next: string | null } {
    if (video.stage === "published") return { state: "done", next: null };

    // The script doesn't count — that belongs to CREATE. What marks
    // publishing as started is a description, a post, an ad: the text
    // that goes out WITH the video.
    const written = video.contentItems.filter((i) => i.type !== "youtube-script");
    if (written.length > 0) return { state: "doing", next: "mark it published" };

    return { state: "todo", next: "write the posts" };
}

export function chainFor(input: ChainInput): Chain {
    const steps: ChainStep[] = [
        { stage: "create", label: "Create", ...createState(input) },
        { stage: "edit", label: "Edit", ...editState(input.video) },
        { stage: "publish", label: "Publish", ...publishState(input.video) },
    ];

    return {
        steps,
        current: steps.find((s) => s.state !== "done") ?? steps[steps.length - 1],
        done: steps.filter((s) => s.state === "done").length,
        total: steps.length,
    };
}

/**
 * The one sentence to put under a video's title.
 *
 * A failed transcript overrides the chain: it is the only state where
 * something went wrong rather than simply not having happened, and
 * burying that under "nothing yet" is how a failure goes unnoticed.
 */
export function chainSummary(input: ChainInput): string {
    if (input.video.transcriptStatus === "failed") {
        return "Transcription failed — read the error and run it again.";
    }
    const chain = chainFor(input);
    if (chain.current.state === "done") return "Done. Nothing pending.";
    return `${chain.current.label} — ${chain.current.next}`;
}
