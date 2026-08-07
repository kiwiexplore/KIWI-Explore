import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Panel from "../ui/Panel";
import { fetchUpcomingLaunches, type SpaceMission } from "../../lib/spaceMissions";
import "./SpaceMissionsWidget.css";

interface SpaceMissionsWidgetProps {
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function formatLaunchDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SpaceMissionsDetail({ missions, error }: { missions: SpaceMission[]; error: boolean }) {
    if (error) {
        return <div className="space-missions-detail-error">Unable to load upcoming launches right now — check your connection and try again.</div>;
    }
    if (missions.length === 0) {
        return <div className="space-missions-detail-error">Loading…</div>;
    }
    return (
        <div className="space-missions-detail">
            {missions.map((m) => (
                <a
                    key={m.id}
                    className="space-missions-detail-item"
                    href={`https://www.google.com/search?q=${encodeURIComponent(m.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {m.imageUrl && <img className="space-missions-detail-thumb" src={m.imageUrl} alt="" />}
                    <div className="space-missions-detail-text">
                        <div className="space-missions-detail-title">{m.name}</div>
                        <div className="space-missions-detail-meta">{formatLaunchDate(m.net)} · {m.statusName}</div>
                        <div className="space-missions-detail-pad">{m.padName}{m.locationName ? `, ${m.locationName}` : ""}</div>
                    </div>
                </a>
            ))}
        </div>
    );
}

/**
 * Third live-data widget (see WeatherWidget's doc comment for the
 * broader context) — The Space Devs' Launch Library 2
 * (ll.thespacedevs.com), free/keyless/CORS-enabled, no backend needed.
 * Compact view shows just the next upcoming launch; clicking opens the
 * same DetailDrawer every other widget uses, with the next few launches
 * each linking out to a search for more detail (Launch Library's own API
 * doesn't include a direct public article URL per launch).
 */
export default function SpaceMissionsWidget({ onOpenDetail }: SpaceMissionsWidgetProps) {
    const [missions, setMissions] = useState<SpaceMission[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchUpcomingLaunches(5);
                if (!cancelled) setMissions(data);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("🚀 Space Missions", anchor, <SpaceMissionsDetail missions={missions} error={error} />, 560);
    };

    let body: ReactNode;
    if (error) {
        body = <span className="space-missions-widget-muted">Unable to load launches.</span>;
    } else if (missions.length === 0) {
        body = <span className="space-missions-widget-muted">Loading…</span>;
    } else {
        const next = missions[0];
        body = (
            <div className="space-missions-widget-body">
                <div className="space-missions-widget-title">{next.name}</div>
                <div className="space-missions-widget-meta">{formatLaunchDate(next.net)}</div>
                <div className="space-missions-widget-status">{next.statusName}</div>
            </div>
        );
    }

    return <Panel title="🚀 Space Missions" onClick={handleClick}>{body}</Panel>;
}
