import { useSyncExternalStore } from "react";

/**
 * A list of your own things, kept in this browser.
 *
 * Some of what KIWI holds isn't fetched from anywhere — it's yours:
 * what you're reading, what you trained. There's no API for that and
 * no backend to put it in yet, so it lives in localStorage, which is
 * the honest answer for now: it survives a reload and a restart, and
 * it does not follow you to another machine. When the backend arrives
 * these become the first things it syncs.
 *
 * The same machinery as saved recipes (see savedRecipes.ts), pulled
 * out here once a second list needed it. Kept outside React — a
 * module-level array plus subscribers, read through
 * useSyncExternalStore — because a module's summary row and its open
 * panel are two separate mounts that have to agree the instant either
 * one changes something.
 */

export interface LocalItem {
    id: string;
    /** Epoch ms, so a list can show newest first without a date parse. */
    createdAt: number;
}

export interface LocalList<T extends LocalItem> {
    /** Reads the list, and re-renders the caller when it changes. */
    use: () => T[];
    add: (item: Omit<T, "id" | "createdAt">) => void;
    update: (id: string, changes: Partial<T>) => void;
    remove: (id: string) => void;
}

export function createLocalList<T extends LocalItem>(storageKey: string): LocalList<T> {
    const read = (): T[] => {
        try {
            const raw = localStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed as T[] : [];
        } catch {
            return [];
        }
    };

    // The live copy. Replaced wholesale on every change rather than
    // mutated, so useSyncExternalStore sees a new reference.
    let items = read();
    const listeners = new Set<() => void>();

    const publish = (next: T[]) => {
        items = next;
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            // A full or blocked storage shouldn't take the list down
            // with it — it still works for this session.
        }
        listeners.forEach((listener) => listener());
    };

    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    };

    // Another tab editing the same list counts as a change here too.
    if (typeof window !== "undefined") {
        window.addEventListener("storage", (event) => {
            if (event.key !== storageKey) return;
            items = read();
            listeners.forEach((listener) => listener());
        });
    }

    return {
        use: () => useSyncExternalStore(subscribe, () => items, () => items),
        add: (item) => publish([
            { ...item, id: crypto.randomUUID(), createdAt: Date.now() } as T,
            ...items,
        ]),
        update: (id, changes) => publish(items.map(
            (item) => (item.id === id ? { ...item, ...changes } : item),
        )),
        remove: (id) => publish(items.filter((item) => item.id !== id)),
    };
}
