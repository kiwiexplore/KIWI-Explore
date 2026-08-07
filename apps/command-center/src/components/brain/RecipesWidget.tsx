import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Panel from "../ui/Panel";
import { fetchRandomRecipes, type Recipe } from "../../lib/recipes";
import "./RecipesWidget.css";

interface RecipesWidgetProps {
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function RecipesDetail({ recipes, error }: { recipes: Recipe[]; error: boolean }) {
    if (error) {
        return <div className="recipes-detail-error">Unable to load recipes right now — check your connection and try again.</div>;
    }
    if (recipes.length === 0) {
        return <div className="recipes-detail-error">Loading…</div>;
    }
    return (
        <div className="recipes-detail">
            {recipes.map((r) => (
                <a key={r.id} className="recipes-detail-item" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <img className="recipes-detail-thumb" src={r.thumbnail} alt="" />
                    <div className="recipes-detail-text">
                        <div className="recipes-detail-title">{r.name}</div>
                        <div className="recipes-detail-meta">{r.category} · {r.area}</div>
                    </div>
                </a>
            ))}
        </div>
    );
}

/**
 * Fourth live-data widget (see WeatherWidget's doc comment for the
 * broader context) — TheMealDB (themealdb.com), free public test key,
 * CORS-enabled, no backend needed. Compact view shows one random recipe
 * idea; clicking opens the same DetailDrawer every other widget uses,
 * with a handful more each linking out to the original source (or its
 * YouTube video, whichever TheMealDB actually has for that meal).
 */
export default function RecipesWidget({ onOpenDetail }: RecipesWidgetProps) {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchRandomRecipes(5);
                if (!cancelled) setRecipes(data);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("🍳 Recipes", anchor, <RecipesDetail recipes={recipes} error={error} />, 560);
    };

    let body: ReactNode;
    if (error) {
        body = <span className="recipes-widget-muted">Unable to load recipes.</span>;
    } else if (recipes.length === 0) {
        body = <span className="recipes-widget-muted">Loading…</span>;
    } else {
        const first = recipes[0];
        body = (
            <div className="recipes-widget-body">
                <img className="recipes-widget-thumb" src={first.thumbnail} alt="" />
                <div className="recipes-widget-title">{first.name}</div>
                <div className="recipes-widget-meta">{first.category} · {first.area}</div>
            </div>
        );
    }

    return <Panel title="🍳 Recipes" onClick={handleClick}>{body}</Panel>;
}
