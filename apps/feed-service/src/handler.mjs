import { liberecStories } from "./liberec.mjs";

/**
 * KIWI's feed service: the small amount of server this dashboard needs.
 *
 * Everything else in KIWI talks to public APIs straight from the
 * browser, with no backend of its own. A handful of sources make that
 * impossible — not because they're private, but because they answer
 * without the CORS header a browser insists on before letting a page
 * read a response. This service reads them instead and re-serves the
 * result as JSON with that header attached.
 *
 * Written as a plain request handler rather than as a framework app so
 * the same function can be mounted two ways: standalone (server.mjs)
 * and inside the dashboard's own dev server (see the command-center's
 * vite.config.ts), which is what makes `npm run dev` enough to have
 * both. It also has no dependencies at all — the whole thing is Node's
 * own fetch, its http server, and about a hundred lines of parsing.
 */

// Results are held this long before anyone's request causes a fetch
// again. Regional news doesn't move faster than this, and it keeps a
// dashboard left open all day from knocking on someone's server every
// time a component mounts.
const TTL_MS = 5 * 60 * 1000;

const cache = new Map();

async function cached(key, load) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.at < TTL_MS) return entry.value;

    const value = await load();
    cache.set(key, { value, at: Date.now() });
    return value;
}

function send(res, status, body) {
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        // The whole point of this service. Open, because what it serves
        // is public news that anyone could fetch themselves — there is
        // nothing here belonging to whoever is running it.
        "access-control-allow-origin": "*",
        // The dashboard has its own five-minute cache; this lets a
        // reload skip the round trip entirely.
        "cache-control": "public, max-age=120",
    });
    res.end(JSON.stringify(body));
}

/**
 * Handles one request, or returns false if the path isn't ours — which
 * is what lets Vite's dev server fall through to the app for
 * everything else.
 */
export async function handleFeedRequest(req, res) {
    const path = (req.url ?? "").split("?")[0];

    if (path === "/api/health") {
        send(res, 200, { ok: true });
        return true;
    }

    if (path === "/api/liberec") {
        try {
            const stories = await cached("liberec", liberecStories);
            send(res, 200, { stories });
        } catch (error) {
            // The dashboard treats a failure here as "no extra sources"
            // and still shows the two it reads itself, so this only has
            // to be honest, not graceful.
            send(res, 502, { error: String(error?.message ?? error), stories: [] });
        }
        return true;
    }

    return false;
}
