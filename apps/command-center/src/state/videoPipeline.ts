import type { VideoProject, VideoStage } from "../lib/videoApi";

/**
 * The Laboratory, arranged around making a video.
 *
 * This deliberately does NOT invent a new set of phases. The six steps
 * below ARE video_projects.stage — the column the server already writes
 * and reads (see apps/server/src/db.ts). A second, parallel idea of
 * "what stage is this at" would drift from the real one within a week.
 *
 * Each step says the one thing to do next, so a video sitting in a stage
 * always has an obvious next action rather than a wall of options.
 */

export interface PipelineStep {
    stage: VideoStage;
    step: number;
    label: string;
    /** The single next action, phrased as an instruction. */
    todo: string;
}

export const PIPELINE: PipelineStep[] = [
    { stage: "idea", step: 1, label: "Idea", todo: "Say what the video is about." },
    { stage: "script", step: 2, label: "Script", todo: "Draft the script, then go record it." },
    { stage: "recorded", step: 3, label: "Recorded", todo: "Point it at the recording on disk." },
    { stage: "transcribing", step: 4, label: "Transcribing", todo: "Whisper is running — this updates itself." },
    { stage: "editing", step: 5, label: "Editing", todo: "Pull the clips, write the posts and ads." },
    { stage: "published", step: 6, label: "Published", todo: "Done. Nothing left to do here." },
];

export function stepFor(stage: VideoStage): PipelineStep {
    return PIPELINE.find((s) => s.stage === stage) ?? PIPELINE[0];
}

/**
 * The one thing this video is waiting on, in plain words. Written to be
 * read on a card without opening anything — "what do I do with this"
 * answered before you click.
 *
 * A failed transcript overrides the stage: it's the only state where
 * something went wrong rather than simply not having happened yet, and
 * burying that behind the stage label is how a failure goes unnoticed.
 */
export function nextAction(project: VideoProject): string {
    if (project.transcriptStatus === "failed") return "Transcription failed — read the error and run it again.";
    if (project.transcriptStatus === "processing") return "Transcribing right now.";

    switch (project.stage) {
        case "idea":
            return project.contentItems.some((i) => i.type === "youtube-script")
                ? "Script is written — go record it."
                : "Draft the script.";
        case "script":
            return "Record it, then add the file path.";
        case "recorded":
            return project.sourceVideoPath ? "Transcribe the recording." : "Add the path to the recording.";
        case "transcribing":
            return "Waiting on the transcript.";
        case "editing":
            return project.clips.length === 0 ? "Find the clips worth cutting." : "Write the posts and ads.";
        case "published":
            return "Live. Nothing pending.";
    }
}

export interface StageGroup {
    step: PipelineStep;
    videos: VideoProject[];
}

/** Videos bucketed by stage, in pipeline order. Empty stages included. */
export function groupByStage(projects: VideoProject[]): StageGroup[] {
    return PIPELINE.map((step) => ({
        step,
        videos: projects.filter((p) => p.stage === step.stage),
    }));
}

/** Anything that went wrong and is sitting there unnoticed. */
export function needsAttention(projects: VideoProject[]): VideoProject[] {
    return projects.filter((p) => p.transcriptStatus === "failed");
}
