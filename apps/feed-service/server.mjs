import { createServer } from "node:http";
import { handleFeedRequest } from "./src/handler.mjs";

/**
 * The feed service on its own port — for running it apart from the
 * dashboard, or for deploying it somewhere. During local development
 * you don't need this: the dashboard's dev server mounts the same
 * handler itself (see the command-center's vite.config.ts), so
 * `npm run dev` there already answers /api/liberec.
 */
const port = Number(process.env.PORT) || 5174;

createServer(async (req, res) => {
    if (await handleFeedRequest(req, res)) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
}).listen(port, () => {
    console.log(`KIWI feed service listening on http://localhost:${port}`);
});
