import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Panel from "../ui/Panel";
import { fetchSpaceNews, type SpaceNewsArticle } from "../../lib/spaceNews";
import "./SpaceNewsWidget.css";

interface SpaceNewsWidgetProps {
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SpaceNewsDetail({ articles, error }: { articles: SpaceNewsArticle[]; error: boolean }) {
    if (error) {
        return <div className="space-news-detail-error">Unable to load space news right now — check your connection and try again.</div>;
    }
    if (articles.length === 0) {
        return <div className="space-news-detail-error">Loading…</div>;
    }
    return (
        <div className="space-news-detail">
            {articles.map((a) => (
                <a key={a.id} className="space-news-detail-item" href={a.url} target="_blank" rel="noopener noreferrer">
                    {a.imageUrl && <img className="space-news-detail-thumb" src={a.imageUrl} alt="" />}
                    <div className="space-news-detail-text">
                        <div className="space-news-detail-title">{a.title}</div>
                        <div className="space-news-detail-meta">{a.newsSite} · {formatDate(a.publishedAt)}</div>
                        <div className="space-news-detail-summary">{a.summary}</div>
                    </div>
                </a>
            ))}
        </div>
    );
}

/**
 * Second widget wired up to real, live data (see WeatherWidget's doc
 * comment for the broader context) — The Spaceflight News API
 * (spaceflightnewsapi.net), free/keyless/CORS-enabled, no backend
 * needed. Compact view shows just the latest headline; clicking opens
 * the same DetailDrawer every other widget uses, with a short list of
 * recent articles each linking out to the original source.
 */
export default function SpaceNewsWidget({ onOpenDetail }: SpaceNewsWidgetProps) {
    const [articles, setArticles] = useState<SpaceNewsArticle[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchSpaceNews(5);
                if (!cancelled) setArticles(data);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("🌌 Space News", anchor, <SpaceNewsDetail articles={articles} error={error} />, 560);
    };

    let body: ReactNode;
    if (error) {
        body = <span className="space-news-widget-muted">Unable to load space news.</span>;
    } else if (articles.length === 0) {
        body = <span className="space-news-widget-muted">Loading…</span>;
    } else {
        const latest = articles[0];
        body = (
            <div className="space-news-widget-body">
                {latest.imageUrl && <img className="space-news-widget-thumb" src={latest.imageUrl} alt="" />}
                <div className="space-news-widget-title">{latest.title}</div>
                <div className="space-news-widget-meta">{latest.newsSite} · {formatDate(latest.publishedAt)}</div>
            </div>
        );
    }

    return <Panel title="🌌 Space News" onClick={handleClick}>{body}</Panel>;
}
