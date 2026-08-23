import { useState, type FormEvent } from "react";
import { FileText, Instagram, Megaphone, MessageSquare, Music2, Trash2, Youtube } from "lucide-react";
import type { ContentHubState } from "../../state/contentHub";
import type { ContentItem, ContentStatus, ContentType, GeneratableContentType } from "../../lib/contentApi";
import "./GlobalBoard.css";
import "./AnalyticsPage.css";
import "./ContentHubBoard.css";

interface ContentHubBoardProps {
    contentHub: ContentHubState;
}

const TYPE_META: Record<ContentType, { label: string; icon: typeof Youtube }> = {
    "youtube-script": { label: "YouTube Script", icon: Youtube },
    "instagram-post": { label: "Instagram Post", icon: Instagram },
    "tiktok-post": { label: "TikTok Post", icon: Music2 },
    "facebook-post": { label: "Facebook Post", icon: MessageSquare },
    ad: { label: "Ad", icon: Megaphone },
};

// Every type this board might have to RENDER — ads included, since
// Video Studio writes them into the same table and they come back from
// GET /api/content like anything else.
const TYPE_ORDER: ContentType[] = ["youtube-script", "instagram-post", "tiktok-post", "facebook-post", "ad"];

// What the Generate form offers. Ads are missing on purpose: one is
// written to promote a specific video, so it's generated from Video
// Studio with that video's script/transcript in hand, not from a bare
// topic here.
const GENERATE_TYPE_ORDER: GeneratableContentType[] = ["youtube-script", "instagram-post", "tiktok-post", "facebook-post"];

const TYPE_COLOR: Record<ContentType, string> = {
    "youtube-script": "#FF0000",
    "instagram-post": "#E1306C",
    "tiktok-post": "#25F4EE",
    "facebook-post": "#1877F2",
    ad: "#7566FF",
};

const STATUS_META: Record<ContentStatus, { label: string; color: string }> = {
    idea: { label: "Idea", color: "#8b93a7" },
    scheduled: { label: "Scheduled", color: "#49C7FF" },
    published: { label: "Published", color: "#6EF3A5" },
};

const STATUS_ORDER: ContentStatus[] = ["idea", "scheduled", "published"];

function nextStatus(current: ContentStatus): ContentStatus {
    return STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatScheduledDate(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

interface ContentItemRowProps {
    item: ContentItem;
    expanded: boolean;
    onToggleExpand: () => void;
    onCycleStatus: () => void;
    onSetDate: (date: string | null) => void;
    onRemove: () => void;
}

function ContentItemRow({ item, expanded, onToggleExpand, onCycleStatus, onSetDate, onRemove }: ContentItemRowProps) {
    const meta = TYPE_META[item.type];
    const statusMeta = STATUS_META[item.status];
    return (
        <div className="content-hub-item">
            <div className="content-hub-item-header">
                <button type="button" className="content-hub-item-header-main" onClick={onToggleExpand}>
                    <meta.icon size={15} strokeWidth={1.75} />
                    <span className="content-hub-item-topic">{item.topic}</span>
                </button>
                <input
                    type="date"
                    className="content-hub-item-date-input"
                    value={item.scheduledDate ?? ""}
                    onChange={(e) => onSetDate(e.target.value || null)}
                />
                <button
                    type="button"
                    className="content-hub-item-status-pill"
                    style={{ color: statusMeta.color, borderColor: statusMeta.color }}
                    onClick={onCycleStatus}
                    title="Click to advance status"
                >
                    {statusMeta.label}
                </button>
            </div>
            {expanded && (
                <div className="content-hub-item-body">
                    <pre className="content-hub-item-content">{item.content}</pre>
                    <div className="content-hub-item-body-footer">
                        <span className="content-hub-item-generated-at">Generated {formatDate(item.created_at)}</span>
                        <button type="button" className="content-hub-item-remove" onClick={onRemove}>
                            <Trash2 size={13} strokeWidth={1.75} />
                            Remove
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BreakdownPanel({ title, rows }: { title: string; rows: { label: string; color: string; count: number }[] }) {
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return (
        <section className="analytics-panel">
            <h2>{title}</h2>
            {total === 0 ? (
                <p className="analytics-empty">Nothing generated yet.</p>
            ) : (
                <div className="analytics-status-list">
                    {rows.filter((r) => r.count > 0).map((r) => (
                        <div key={r.label} className="analytics-status-row">
                            <span className="analytics-status-dot" style={{ background: r.color }} />
                            <span className="analytics-status-label">{r.label}</span>
                            <div className="analytics-status-track">
                                <div className="analytics-status-fill" style={{ width: `${Math.round((r.count / total) * 100)}%`, background: r.color }} />
                            </div>
                            <span className="analytics-status-count">{r.count}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

/**
 * Content Hub's Analytics tab — a rollup of what's actually been
 * generated here, same "no fabricated widgets" discipline as
 * Laboratory's main AnalyticsPage. Channel-side numbers (subscribers/
 * views) would need the Google connection, whose connect/disconnect UI
 * doesn't exist on this branch — so rather than show empty tiles that
 * can never fill, they're left out entirely and the hint below says so.
 */
function ContentAnalytics({ contentHub }: { contentHub: ContentHubState }) {
    const byType = TYPE_ORDER.map((t) => ({
        label: TYPE_META[t].label,
        color: TYPE_COLOR[t],
        count: contentHub.items.filter((i) => i.type === t).length,
    }));
    const byStatus = STATUS_ORDER.map((s) => ({
        label: STATUS_META[s].label,
        color: STATUS_META[s].color,
        count: contentHub.items.filter((i) => i.status === s).length,
    }));

    return (
        <div className="content-hub-analytics">
            <div className="analytics-tiles">
                <div className="analytics-tile">
                    <span className="analytics-tile-value">{contentHub.items.length}</span>
                    <span className="analytics-tile-label">Generated</span>
                </div>
                <div className="analytics-tile">
                    <span className="analytics-tile-value">{contentHub.items.filter((i) => i.status === "scheduled").length}</span>
                    <span className="analytics-tile-label">Scheduled</span>
                </div>
                <div className="analytics-tile">
                    <span className="analytics-tile-value">{contentHub.items.filter((i) => i.status === "published").length}</span>
                    <span className="analytics-tile-label">Published</span>
                </div>
            </div>

            <div className="content-hub-hint">
                <Youtube size={14} strokeWidth={2} />
                <span>
                    These count what's been generated here. Real channel numbers (subscribers, views) need the Google
                    connection, which has no connect UI on this branch — so they aren't shown rather than shown empty.
                </span>
            </div>

            <div className="analytics-grid">
                <BreakdownPanel title="By type" rows={byType} />
                <BreakdownPanel title="By status" rows={byStatus} />
            </div>
        </div>
    );
}

type View = "generate" | "schedule" | "analytics";

const VIEW_LABELS: Record<View, string> = { generate: "Generate", schedule: "Schedule", analytics: "Analytics" };
const VIEW_ORDER: View[] = ["generate", "schedule", "analytics"];

/**
 * Laboratory's Content Hub — real generation (POST /api/content/generate,
 * apps/server's src/contentGenerator.ts calling Claude directly, same
 * account owner's Anthropic key as Hey Kiwi), unlike this section's AI
 * Tools siblings (Image Generation/Market Analysis/Trend Scanner),
 * which are honest "not connected yet" logs — see each of their own
 * doc comments. One-shot per generation, no conversation/memory
 * involved, just "given this topic, write this specific thing".
 *
 * Three views over the same items: Generate (newest first, where new
 * pieces get created), Schedule (grouped by scheduled_date, for
 * planning what goes out when — see state/contentHub.ts's `update`),
 * and Analytics (real YouTube numbers + a rollup of what's been
 * generated). Status/date controls live on every row in Generate/
 * Schedule regardless of view, so you can schedule something the
 * moment it's generated without switching tabs.
 */
export default function ContentHubBoard({ contentHub }: ContentHubBoardProps) {
    const [view, setView] = useState<View>("generate");
    const [type, setType] = useState<GeneratableContentType>("youtube-script");
    const [topic, setTopic] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!topic.trim() || contentHub.generating) return;
        contentHub.generate(type, topic.trim());
        setTopic("");
    };

    const rowProps = (item: ContentItem) => ({
        item,
        expanded: expandedId === item.id,
        onToggleExpand: () => setExpandedId(expandedId === item.id ? null : item.id),
        onCycleStatus: () => contentHub.update(item.id, { status: nextStatus(item.status) }),
        onSetDate: (date: string | null) => contentHub.update(item.id, { scheduledDate: date }),
        onRemove: () => contentHub.remove(item.id),
    });

    const scheduledGroups = view === "schedule"
        ? Object.entries(
            contentHub.items.reduce<Record<string, ContentItem[]>>((groups, item) => {
                const key = item.scheduledDate ?? "Unscheduled";
                (groups[key] ??= []).push(item);
                return groups;
            }, {}),
        ).sort(([a], [b]) => (a === "Unscheduled" ? 1 : b === "Unscheduled" ? -1 : a.localeCompare(b)))
        : [];

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Content Hub</h1>
                </div>
                {contentHub.items.length > 0 && <span className="global-board-summary">{contentHub.items.length} generated</span>}
            </div>

            <div className="content-hub-view-switch">
                {VIEW_ORDER.map((v) => (
                    <button
                        key={v}
                        type="button"
                        className={`content-hub-view-btn${view === v ? " content-hub-view-btn-active" : ""}`}
                        onClick={() => setView(v)}
                    >
                        {VIEW_LABELS[v]}
                    </button>
                ))}
            </div>

            {view === "generate" && (
                <form className="content-hub-form" onSubmit={handleSubmit}>
                    <div className="content-hub-type-switch">
                        {GENERATE_TYPE_ORDER.map((t) => {
                            const meta = TYPE_META[t];
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    className={`content-hub-type-btn${type === t ? " content-hub-type-btn-active" : ""}`}
                                    onClick={() => setType(t)}
                                >
                                    <meta.icon size={14} strokeWidth={1.75} />
                                    {meta.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="content-hub-form-row">
                        <input
                            type="text"
                            className="content-hub-topic-input"
                            placeholder="What's it about? e.g. 3 gear mistakes new hikers make"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={contentHub.generating}
                        />
                        <button type="submit" className="content-hub-generate-btn" disabled={!topic.trim() || contentHub.generating}>
                            {contentHub.generating ? "Generating…" : "Generate"}
                        </button>
                    </div>
                </form>
            )}

            {contentHub.error && <p className="content-hub-error">{contentHub.error}</p>}

            {view === "analytics" ? (
                <ContentAnalytics contentHub={contentHub} />
            ) : contentHub.loading ? (
                <p className="content-hub-loading">Loading…</p>
            ) : contentHub.items.length === 0 ? (
                <div className="global-board-empty">Nothing generated yet — pick a type, describe a topic, and hit Generate.</div>
            ) : view === "generate" ? (
                <div className="content-hub-list">
                    {contentHub.items.map((item) => <ContentItemRow key={item.id} {...rowProps(item)} />)}
                </div>
            ) : (
                <div className="content-hub-schedule">
                    {scheduledGroups.map(([date, groupItems]) => (
                        <div key={date} className="content-hub-schedule-group">
                            <div className="content-hub-schedule-group-title">
                                {date === "Unscheduled" ? "Unscheduled" : formatScheduledDate(date)}
                            </div>
                            <div className="content-hub-list">
                                {groupItems.map((item) => <ContentItemRow key={item.id} {...rowProps(item)} />)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view !== "analytics" && !contentHub.loading && contentHub.items.length === 0 && (
                <div className="content-hub-hint">
                    <FileText size={14} strokeWidth={2} />
                    <span>Needs an Anthropic API key configured in apps/server/.env — same one Hey Kiwi uses.</span>
                </div>
            )}
        </div>
    );
}
