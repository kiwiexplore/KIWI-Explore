import { createLocalList, type LocalItem } from "./localList";

/** One session: what you did and how long it took. */
export interface TrainingEntry extends LocalItem {
    activity: string;
    minutes: number;
    /** ISO date (YYYY-MM-DD) — the day it happened, not when it was typed. */
    date: string;
}

export const trainingLog = createLocalList<TrainingEntry>("kiwi.training");

/** Minutes in the last seven days — what the module leads with. */
export function weekMinutes(entries: TrainingEntry[], now = new Date()): number {
    const since = new Date(now);
    since.setDate(since.getDate() - 7);
    const cutoff = since.toISOString().slice(0, 10);
    return entries
        .filter((entry) => entry.date >= cutoff)
        .reduce((total, entry) => total + entry.minutes, 0);
}
