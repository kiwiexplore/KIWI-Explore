import { useState, type FormEvent } from "react";
import { learningList, type LearningItem } from "../../../state/learningItems";
import { trainingLog, weekMinutes } from "../../../state/trainingLog";
import type { ModuleViewProps } from "./types";

/**
 * The two modules whose data is nobody's API — it's yours.
 *
 * Everything else in a region is fetched from somewhere: the weather,
 * the headlines, the price of a coin. What you're reading and what you
 * trained isn't published anywhere, so these are typed in and kept in
 * this browser (see state/localList.ts). That's also why they could be
 * built now, while Communication and Travel still wait on a backend —
 * they were never waiting on anything.
 */

const KINDS = ["Book", "Course", "Skill"];

export function LearningModule({ mode }: ModuleViewProps) {
    const items = learningList.use();
    const [title, setTitle] = useState("");
    const [kind, setKind] = useState(KINDS[0]);

    if (mode === "summary") {
        if (items.length === 0) return <>Nothing on the go</>;
        const active = items.filter((item) => item.progress < 100);
        const lead = active[0] ?? items[0];
        return <>{lead.title} · {lead.progress}%{active.length > 1 ? ` · ${active.length} on the go` : ""}</>;
    }

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        learningList.add({ title: title.trim(), kind, progress: 0 } as Omit<LearningItem, "id" | "createdAt">);
        setTitle("");
    };

    return (
        <div className="module-detail">
            <form className="module-form" onSubmit={submit}>
                <input
                    className="module-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="What are you reading or learning?"
                    aria-label="Title"
                />
                <select
                    className="module-select"
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    aria-label="Kind"
                >
                    {KINDS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button type="submit" className="module-add">Add</button>
            </form>

            {items.length === 0 ? (
                <p className="module-note">
                    Nothing here yet. Whatever you add stays in this browser —
                    there's no account behind it, and nothing is sent anywhere.
                </p>
            ) : (
                <ul className="module-list">
                    {items.map((item) => (
                        <li key={item.id} className="module-track">
                            <span className="module-track-title">{item.title}</span>
                            <span className="module-track-kind">{item.kind}</span>
                            <button
                                type="button"
                                className="module-step"
                                aria-label={`Less progress on ${item.title}`}
                                onClick={() => learningList.update(item.id, { progress: Math.max(0, item.progress - 10) })}
                            >
                                −
                            </button>
                            <span className="module-track-figure">{item.progress}%</span>
                            <button
                                type="button"
                                className="module-step"
                                aria-label={`More progress on ${item.title}`}
                                onClick={() => learningList.update(item.id, { progress: Math.min(100, item.progress + 10) })}
                            >
                                +
                            </button>
                            <button
                                type="button"
                                className="module-step module-step-drop"
                                aria-label={`Remove ${item.title}`}
                                onClick={() => learningList.remove(item.id)}
                            >
                                ×
                            </button>
                            {/* The bar spans the row under it, so a list of
                                these reads as progress at a glance. */}
                            <span className="module-track-bar">
                                <span className="module-track-fill" style={{ width: `${item.progress}%` }} />
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function HealthModule({ mode }: ModuleViewProps) {
    const entries = trainingLog.use();
    const [activity, setActivity] = useState("");
    const [minutes, setMinutes] = useState("45");

    const week = weekMinutes(entries);

    if (mode === "summary") {
        if (entries.length === 0) return <>No sessions logged</>;
        return <>{Math.round(week / 60 * 10) / 10}h this week · last: {entries[0].activity}</>;
    }

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const length = Number(minutes);
        if (!activity.trim() || !Number.isFinite(length) || length <= 0) return;
        trainingLog.add({
            activity: activity.trim(),
            minutes: Math.round(length),
            date: new Date().toISOString().slice(0, 10),
        });
        setActivity("");
    };

    return (
        <div className="module-detail">
            <div className="module-headline">
                <span className="module-headline-figure">{Math.floor(week / 60)}h {week % 60}m</span>
                <span className="module-headline-note">
                    in the last seven days · {entries.length} session{entries.length === 1 ? "" : "s"} logged
                </span>
            </div>

            <form className="module-form" onSubmit={submit}>
                <input
                    className="module-input"
                    value={activity}
                    onChange={(event) => setActivity(event.target.value)}
                    placeholder="Gym, run, climbing…"
                    aria-label="Activity"
                />
                <input
                    className="module-select"
                    type="number"
                    min="1"
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                    aria-label="Minutes"
                />
                <button type="submit" className="module-add">Log</button>
            </form>

            {entries.length === 0 ? (
                <p className="module-note">
                    Nothing logged yet. Sessions stay in this browser — no
                    account, no device to pair, nothing sent anywhere.
                </p>
            ) : (
                <ul className="module-list">
                    {entries.map((entry) => (
                        <li key={entry.id} className="module-row">
                            <span className="module-row-lead">
                                {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                            <span>{entry.activity}</span>
                            <span className="module-row-trail">
                                {entry.minutes} min
                                <button
                                    type="button"
                                    className="module-step module-step-drop"
                                    aria-label={`Remove ${entry.activity}`}
                                    onClick={() => trainingLog.remove(entry.id)}
                                >
                                    ×
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <p className="module-note">
                Sleep and nutrition need a device or an account to read from,
                so they aren't here — this is the half that needs neither.
            </p>
        </div>
    );
}
