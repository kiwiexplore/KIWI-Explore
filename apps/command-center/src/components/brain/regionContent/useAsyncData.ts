import { useEffect, useState } from "react";

// How long a finished fetch stays good for. Long enough that drilling
// into a module and stepping back out doesn't refetch anything, short
// enough that a dashboard left open all day isn't showing yesterday's
// news.
const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
    promise: Promise<unknown>;
    // Set only once the promise settles — an in-flight entry has no
    // timestamp yet, which is what makes two components mounting in the
    // same tick share one request instead of racing.
    settledAt?: number;
}

const cache = new Map<string, CacheEntry>();

function load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = cache.get(key);
    if (existing && (existing.settledAt === undefined || Date.now() - existing.settledAt < TTL_MS)) {
        return existing.promise as Promise<T>;
    }

    const entry: CacheEntry = { promise: Promise.resolve() };
    entry.promise = loader().then(
        (value) => { entry.settledAt = Date.now(); return value; },
        (error) => {
            // Failures are NOT cached for the full TTL — a dropped
            // connection shouldn't leave a module dead for five minutes.
            cache.delete(key);
            throw error;
        },
    );
    cache.set(key, entry);
    return entry.promise as Promise<T>;
}

export interface AsyncData<T> {
    data: T | null;
    error: boolean;
    loading: boolean;
}

/**
 * Fetch-once-per-key data loading for the region panel's modules.
 *
 * The panel shows every module of a region as a live summary row and
 * then, when you open one, the same data in full (see BrainRegionPanel's
 * two levels) — that's two separate mounts of the same component asking
 * for the same thing. Without a shared cache, drilling in would throw
 * away a perfectly good result and flash a loading state at the exact
 * moment the user is looking straight at it.
 *
 * `key` identifies the data, not the caller: every module asking for
 * "weather" gets the same in-flight promise. Passing null instead skips
 * the fetch entirely — that's how a caller that only sometimes needs a
 * source (see regionFacts) opts out without breaking hook order.
 */
export function useAsyncData<T>(key: string | null, loader: () => Promise<T>): AsyncData<T> {
    // The key the stored result belongs to is kept alongside it, so a
    // result for the PREVIOUS key can be recognized as stale during
    // render. Resetting to "loading" from inside the effect instead
    // would mean a second render pass every time the key changes.
    const [state, setState] = useState<AsyncData<T> & { key: string | null }>({ key, data: null, error: false, loading: key !== null });

    useEffect(() => {
        if (key === null) return;
        let cancelled = false;

        load(key, loader).then(
            (data) => { if (!cancelled) setState({ key, data, error: false, loading: false }); },
            () => { if (!cancelled) setState({ key, data: null, error: true, loading: false }); },
        );

        return () => { cancelled = true; };
        // `loader` is deliberately not a dependency: it's an inline
        // closure at every call site, so including it would re-run this
        // on every render. `key` is the identity of the data here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    // A null key means this caller doesn't want the data at all right now
    // — the way a hook opts out, since it can't simply not be called.
    if (key === null) return { data: null, error: false, loading: false };
    if (state.key !== key) return { data: null, error: false, loading: true };
    return state;
}
