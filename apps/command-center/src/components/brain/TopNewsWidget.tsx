import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Panel from "../ui/Panel";
import { fetchTopStories, type HackerNewsStory } from "../../lib/hackerNews";
import "./TopNewsWidget.css";

interface TopNewsWidgetProps {
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function TopNewsDetail({ stories, error }: { stories: HackerNewsStory[]; error: boolean }) {
    if (error) {
        return <div className="top-news-detail-error">Unable to load news right now — check your connection and try again.</div>;
    }
    if (stories.length === 0) {
        return <div className="top-news-detail-error">Loading…</div>;
    }
    return (
        <div className="top-news-detail">
            {stories.map((s) => (
                <a key={s.id} className="top-news-detail-item" href={s.url} target="_blank" rel="noopener noreferrer">
                    <div className="top-news-detail-title">{s.title}</div>
                    <div className="top-news-detail-meta">▲ {s.score} · {s.by}</div>
                </a>
            ))}
            <div className="top-news-detail-source">Tech news via Hacker News — not general news.</div>
        </div>
    );
}

/**
 * Tech news via the Hacker News Firebase API, free/keyless/CORS-
 * enabled, no backend needed — same live-widget pattern as
 * WeatherWidget/SpaceNewsWidget. There's no good keyless general-news
 * API with CORS support, so this is honestly tech-only rather than
 * pretending to cover general news.
 */
export default function TopNewsWidget({ onOpenDetail }: TopNewsWidgetProps) {
    const [stories, setStories] = useState<HackerNewsStory[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchTopStories(5);
                if (!cancelled) setStories(data);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("📰 Top News", anchor, <TopNewsDetail stories={stories} error={error} />, 480);
    };

    let body: ReactNode;
    if (error) {
        body = <span className="top-news-widget-muted">Unable to load news.</span>;
    } else if (stories.length === 0) {
        body = <span className="top-news-widget-muted">Loading…</span>;
    } else {
        const latest = stories[0];
        body = (
            <div className="top-news-widget-body">
                <div className="top-news-widget-title">{latest.title}</div>
                <div className="top-news-widget-meta">▲ {latest.score} on Hacker News</div>
            </div>
        );
    }

    return <Panel title="📰 Top News" onClick={handleClick}>{body}</Panel>;
}
