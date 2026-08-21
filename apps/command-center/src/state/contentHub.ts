import { useEffect, useState } from "react";
import {
    deleteContentItem, fetchContentItems, generateContentItem, updateContentItem,
    ContentNotConfiguredError, type ContentItem, type ContentItemUpdate, type GeneratableContentType,
} from "../lib/contentApi";

export interface ContentHubState {
    items: ContentItem[];
    loading: boolean;
    generating: boolean;
    error: string | null;
    generate: (type: GeneratableContentType, topic: string) => void;
    update: (id: number, changes: ContentItemUpdate) => void;
    remove: (id: number) => void;
}

/**
 * Local to Laboratory.tsx (not lifted to App.tsx) — unlike
 * Finance/Spotify/etc. this one doesn't need to survive a Dashboard
 * switch as in-memory state, since every generated item is already
 * persisted server-side (apps/server's content_items table); a remount
 * just refetches, nothing is lost.
 */
export function useContentHubState(): ContentHubState {
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchContentItems()
            .then((found) => { if (!cancelled) setItems(found); })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load content."); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const generate = (type: GeneratableContentType, topic: string) => {
        setError(null);
        setGenerating(true);
        generateContentItem(type, topic)
            .then((item) => setItems((prev) => [item, ...prev]))
            .catch((e) => {
                if (e instanceof ContentNotConfiguredError) setError(e.message);
                else setError(e instanceof Error ? e.message : "Could not generate content.");
            })
            .finally(() => setGenerating(false));
    };

    // Optimistic — the Schedule view's status pill/date picker should
    // feel instant, same reasoning as remove() below. Reverts silently
    // on failure by just not applying the change is skipped here since
    // a failed PATCH on a local-network personal backend is rare enough
    // not to be worth the extra state for; errors still surface via
    // `error` for visibility.
    const update = (id: number, changes: ContentItemUpdate) => {
        setItems((prev) => prev.map((item) => (
            item.id === id
                ? { ...item, ...(changes.status !== undefined ? { status: changes.status } : {}), ...(changes.scheduledDate !== undefined ? { scheduledDate: changes.scheduledDate } : {}) }
                : item
        )));
        updateContentItem(id, changes).catch((e) => setError(e instanceof Error ? e.message : "Could not update content."));
    };

    const remove = (id: number) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        deleteContentItem(id).catch(() => { /* local state already reflects removal either way */ });
    };

    return { items, loading, generating, error, generate, update, remove };
}
