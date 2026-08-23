import type { VideoProject } from "../lib/videoApi";

/**
 * The three phases a video goes through, and what each one is waiting on.
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
 *   EDIT      a rendered file is on disk, in the project's Exports
 *   PUBLISH   the video is marked published
 *
 * GENERATE was a fourth link and is gone. It existed for videos whose
 * pictures were generated rather than shot, and that is not the work
 * this studio is for: the footage comes from a camera, and the scarce
 * thing is having gone out and filmed it. A step that never applies to
 * anything you actually make is a step that only has to be explained.
 *
 * That is deliberately stricter than the stage strip this replaces,
 * which coloured a step green because it was behind you. A chain whose
 * links can be ticked without doing the work is decoration. The one
 * thing it does NOT do is lock: every phase stays reachable, and an
 * unmet gate says what is missing instead of refusing.
 */

export type ChainStage = "create" | "edit" | "publish";

export interface ChainStep {
    stage: ChainStage;
    label: string;
    done: boolean;
    /** What is missing, in words. Null once the gate is met. */
    blocker: string | null;
}

export interface Chain {
    steps: ChainStep[];
    /** The first step that isn't done — where the work actually is. */
    current: ChainStep;
    done: number;
    total: number;
}

function hasScript(video: VideoProject): boolean {
    return video.contentItems.some((item) => item.type === "youtube-script");
}

/**
 * Everything here comes off the video itself.
 *
 * It used to take the project too, for a gate that asked whether the
 * FOLDER had anything in it — which was true for every video in the
 * project at once and so said nothing about any one of them. A gate
 * that can't tell two videos apart isn't measuring either.
 */
export function chainFor(video: VideoProject): Chain {
    const steps: ChainStep[] = [
        {
            stage: "create",
            label: "Create",
            done: hasScript(video),
            blocker: hasScript(video) ? null : "no script yet",
        },
        {
            stage: "edit",
            label: "Edit",
            done: video.exported,
            blocker: video.exported ? null : "nothing exported yet",
        },
        {
            stage: "publish",
            label: "Publish",
            done: video.stage === "published",
            blocker: video.stage === "published" ? null : "not marked published",
        },
    ];

    return {
        steps,
        current: steps.find((s) => !s.done) ?? steps[steps.length - 1],
        done: steps.filter((s) => s.done).length,
        total: steps.length,
    };
}

/**
 * The one sentence to put under a video's title.
 *
 * A failed transcript overrides the chain: it is the only state where
 * something went wrong rather than simply not having happened, and
 * burying that under "no script yet" is how a failure goes unnoticed.
 */
export function chainSummary(video: VideoProject): string {
    if (video.transcriptStatus === "failed") return "Transcription failed — read the error and run it again.";
    const chain = chainFor(video);
    if (chain.current.done) return "Done. Nothing pending.";
    return `${chain.current.label} — ${chain.current.blocker}`;
}
