import { fileURLToPath } from "node:url";
import { liberecStories } from "./liberec.mjs";
import { liberecBrief } from "./brief.mjs";
import { financeStories } from "./finance.mjs";
import { indexQuotes } from "./indices.mjs";
import { inbox, mailConfigured } from "./mail.mjs";

// Read this service's own .env before anything asks for a key.
//
// Node doesn't do this on its own, and neither does the dashboard's dev
// server — its Vite config loads .env files from the command-center's
// directory, not this one. Without this the key would sit in the file
// the setup instructions name and never reach the process that needs
// it. Missing file is the normal case, not an error: only the digest
// needs a key at all.
try {
    process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
    // No .env — the digest reports itself unconfigured and the rest of
    // the service is unaffected.
}

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
 * both.
 *
 * Its only dependency is the Anthropic SDK, and only one endpoint uses
 * it: the digest (brief.mjs). The feeds themselves are Node's own fetch,
 * its http server and about a hundred lines of parsing — no model goes
 * anywhere near the list of headlines.
 */

// Results are held this long before anyone's request causes a fetch
// again. (The digest has a much longer one of its own — see brief.mjs.) Regional news doesn't move faster than this, and it keeps a
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

// The span the dashboard opens on, fetched as soon as this service
// starts rather than when the first visitor asks. Fifty-odd quotes take
// about ten seconds cold, which is a long time to watch an empty
// markets bar — by the time anything is on screen, this has usually
// finished. Failure is fine and silent: the endpoint would just fetch
// it itself.
cached("indices:1d", () => indexQuotes("1d")).catch(() => {});

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

    if (path === "/api/finance") {
        try {
            const stories = await cached("finance", financeStories);
            send(res, 200, { stories });
        } catch (error) {
            send(res, 502, { error: String(error?.message ?? error), stories: [] });
        }
        return true;
    }

    if (path === "/api/indices") {
        try {
            // Each span is cached on its own: switching between them
            // should be instant the second time, and they are genuinely
            // different answers.
            const span = new URL(req.url ?? "", "http://local").searchParams.get("span") ?? "1mo";
            const indices = await cached(`indices:${span}`, () => indexQuotes(span));
            send(res, 200, { indices, span });
        } catch (error) {
            send(res, 502, { error: String(error?.message ?? error), indices: [] });
        }
        return true;
    }

    if (path === "/api/mail") {
        try {
            // Short cache: this one opens a connection to a mail server,
            // and a dashboard left open shouldn't reconnect per render.
            const result = mailConfigured()
                ? await cached("mail", inbox)
                : { configured: false, messages: [], unread: 0 };
            send(res, 200, result);
        } catch (error) {
            // Wrong password, host down, provider refusing IMAP — all
            // the same to the dashboard, which shows the reason.
            send(res, 200, {
                configured: true,
                messages: [],
                unread: 0,
                error: String(error?.message ?? error),
            });
        }
        return true;
    }

    if (path === "/api/liberec/brief") {
        try {
            send(res, 200, await liberecBrief());
        } catch (error) {
            // Same rule as the feed: the dashboard shows its news list
            // with or without a digest, so this only has to be honest.
            send(res, 502, { configured: true, brief: "", error: String(error?.message ?? error) });
        }
        return true;
    }

    return false;
}
