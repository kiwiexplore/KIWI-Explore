import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Panel from "../ui/Panel";
import type { ChartEntry } from "../../lib/itunes";
import "./ChartWidget.css";

interface ChartWidgetProps {
    title: string;
    fetchChart: (limit?: number) => Promise<ChartEntry[]>;
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function ChartDetail({ entries, error }: { entries: ChartEntry[]; error: boolean }) {
    if (error) {
        return <div className="chart-widget-detail-error">Unable to load the chart right now — check your connection and try again.</div>;
    }
    if (entries.length === 0) {
        return <div className="chart-widget-detail-error">Loading…</div>;
    }
    return (
        <div className="chart-widget-detail">
            {entries.map((e, i) => (
                <a key={e.id} className="chart-widget-detail-item" href={e.link} target="_blank" rel="noopener noreferrer">
                    <span className="chart-widget-detail-rank">{i + 1}</span>
                    {e.artworkUrl && <img className="chart-widget-detail-art" src={e.artworkUrl} alt="" />}
                    <div className="chart-widget-detail-text">
                        <div className="chart-widget-detail-name">{e.name}</div>
                        <div className="chart-widget-detail-artist">{e.artist}</div>
                    </div>
                </a>
            ))}
        </div>
    );
}

/**
 * Shared renderer for iTunes top-charts widgets (Music/Podcasts —
 * see BrainScene3D, which passes lib/itunes.ts's fetchTopSongs/
 * fetchTopPodcasts in). Free/keyless/CORS-enabled, no backend needed,
 * same live-widget pattern as WeatherWidget/SpaceNewsWidget. Kept as
 * one component rather than two near-identical files since Music and
 * Podcasts differ only in which chart they fetch and their title.
 */
export default function ChartWidget({ title, fetchChart, onOpenDetail }: ChartWidgetProps) {
    const [entries, setEntries] = useState<ChartEntry[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchChart(6);
                if (!cancelled) setEntries(data);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, [fetchChart]);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail(title, anchor, <ChartDetail entries={entries} error={error} />, 520);
    };

    let body: ReactNode;
    if (error) {
        body = <span className="chart-widget-muted">Unable to load chart.</span>;
    } else if (entries.length === 0) {
        body = <span className="chart-widget-muted">Loading…</span>;
    } else {
        const top = entries[0];
        body = (
            <div className="chart-widget-body">
                {top.artworkUrl && <img className="chart-widget-thumb" src={top.artworkUrl} alt="" />}
                <div className="chart-widget-text">
                    <div className="chart-widget-name">{top.name}</div>
                    <div className="chart-widget-artist">{top.artist}</div>
                </div>
            </div>
        );
    }

    return <Panel title={title} onClick={handleClick}>{body}</Panel>;
}
