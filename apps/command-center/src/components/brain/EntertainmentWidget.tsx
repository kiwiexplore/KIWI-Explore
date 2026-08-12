import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Panel from "../ui/Panel";
import { fetchTodaysSchedule, type TVEntry } from "../../lib/tvmaze";
import "./EntertainmentWidget.css";

interface EntertainmentWidgetProps {
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function EntertainmentDetail({ entries, error }: { entries: TVEntry[]; error: boolean }) {
    if (error) {
        return <div className="entertainment-detail-error">Unable to load tonight's schedule right now — check your connection and try again.</div>;
    }
    if (entries.length === 0) {
        return <div className="entertainment-detail-error">Loading…</div>;
    }
    return (
        <div className="entertainment-detail">
            {entries.map((e) => (
                <div key={e.id} className="entertainment-detail-item">
                    <img className="entertainment-detail-thumb" src={e.image} alt="" />
                    <div className="entertainment-detail-text">
                        <div className="entertainment-detail-title">{e.showName}</div>
                        <div className="entertainment-detail-meta">{e.episodeName} · {e.airtime} · {e.network}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Tonight's US TV schedule via the TVMaze API, free/keyless/CORS-
 * enabled, no backend needed — same live-widget pattern as
 * WeatherWidget/SpaceNewsWidget. Filtered to primetime entries with an
 * image (see lib/tvmaze.ts) so it reads as "what's on tonight" rather
 * than a dump of every local news rerun.
 */
export default function EntertainmentWidget({ onOpenDetail }: EntertainmentWidgetProps) {
    const [entries, setEntries] = useState<TVEntry[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchTodaysSchedule(6);
                if (!cancelled) setEntries(data);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("🎮 Entertainment", anchor, <EntertainmentDetail entries={entries} error={error} />, 520);
    };

    let body: ReactNode;
    if (error) {
        body = <span className="entertainment-widget-muted">Unable to load tonight's schedule.</span>;
    } else if (entries.length === 0) {
        body = <span className="entertainment-widget-muted">Loading…</span>;
    } else {
        const next = entries[0];
        body = (
            <div className="entertainment-widget-body">
                <img className="entertainment-widget-thumb" src={next.image} alt="" />
                <div className="entertainment-widget-title">{next.showName}</div>
                <div className="entertainment-widget-meta">{next.airtime} · {next.network}</div>
            </div>
        );
    }

    return <Panel title="🎮 Entertainment" onClick={handleClick}>{body}</Panel>;
}
