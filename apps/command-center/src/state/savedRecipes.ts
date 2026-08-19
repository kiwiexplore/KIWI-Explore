import { useSyncExternalStore } from "react";
import type { Recipe } from "../lib/recipes";

/**
 * The recipes you've kept.
 *
 * Saved to localStorage rather than to component state because the
 * whole point of a favourite is that it's still there tomorrow — and
 * because the ideas themselves are a random draw from TheMealDB (see
 * lib/recipes), so a recipe you didn't keep is genuinely gone. What's
 * stored is the card, not just the id: the list has to render offline
 * and without five lookups, and the full method is one click away on
 * the source anyway.
 *
 * Lives outside React (a module-level array plus subscribers, read
 * through useSyncExternalStore) because two separate mounts of the
 * meals module — its summary row and its open panel — have to agree on
 * what's saved the instant either of them changes it.
 */

const STORAGE_KEY = "kiwi.saved-recipes";

export interface SavedRecipe {
    id: string;
    name: string;
    category: string;
    area: string;
    thumbnail: string;
    sourceUrl: string;
    /** Epoch ms, so the list can show newest first. */
    savedAt: number;
}

function read(): SavedRecipe[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed as SavedRecipe[] : [];
    } catch {
        return [];
    }
}

// The live copy. Replaced wholesale on every change rather than mutated,
// so useSyncExternalStore sees a new reference and re-renders.
let saved: SavedRecipe[] = read();
const listeners = new Set<() => void>();

function publish(next: SavedRecipe[]) {
    saved = next;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // A full or blocked storage shouldn't take the module down with
        // it — the list still works for this session.
    }
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

// Another tab saving a recipe counts as a change here too.
if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY) return;
        saved = read();
        listeners.forEach((listener) => listener());
    });
}

export function toggleSavedRecipe(recipe: Recipe): void {
    if (saved.some((item) => item.id === recipe.id)) {
        publish(saved.filter((item) => item.id !== recipe.id));
        return;
    }
    publish([
        {
            id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            area: recipe.area,
            thumbnail: recipe.thumbnail,
            sourceUrl: recipe.sourceUrl,
            savedAt: Date.now(),
        },
        ...saved,
    ]);
}

export function removeSavedRecipe(id: string): void {
    publish(saved.filter((item) => item.id !== id));
}

export function useSavedRecipes(): SavedRecipe[] {
    return useSyncExternalStore(subscribe, () => saved, () => saved);
}
