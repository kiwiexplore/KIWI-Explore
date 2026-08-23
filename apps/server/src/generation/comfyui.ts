import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
    EngineUnavailableError, register,
    type GenerationEngine, type GenerationRequest, type GenerationResult,
} from "./engines.js";
import { DEFAULT_WORKFLOW } from "./defaultWorkflow.js";

/**
 * ComfyUI, over the HTTP API it already serves.
 *
 * Local, free, and the only engine here that needs no account — which
 * is why it is the first one. It runs on your own machine at
 * COMFYUI_URL (default http://127.0.0.1:8188).
 *
 * ComfyUI's API takes a GRAPH, not a prompt. There is a built-in
 * default — its own text-to-image workflow, see defaultWorkflow.ts — so
 * a stock install makes a picture without being configured first. That
 * default names a checkpoint, which is the one guess about your machine
 * in here: if you have something other than sd_xl_base_1.0.safetensors,
 * either set COMFYUI_CHECKPOINT, or export your own graph with
 * Save (API format) and point COMFYUI_WORKFLOW at it. Either way this
 * fills in the parts that change per job.
 *
 * Filling in means: find the nodes by CLASS, not by number. Node ids are
 * whatever the graph editor happened to assign and change when you move
 * things around; class_type is stable. The positive prompt is the
 * CLIPTextEncode that the sampler's `positive` input points at — taking
 * "the first CLIPTextEncode" would put the prompt in the negative slot
 * on about half of all workflows.
 */

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

const BASE = (process.env.COMFYUI_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
const WORKFLOW = process.env.COMFYUI_WORKFLOW || path.join(dataDir, "comfyui-workflow.json");

/** ComfyUI's graph, as Save (API format) writes it. */
type Graph = Record<string, { class_type?: string; inputs?: Record<string, unknown> }>;

interface HistoryEntry {
    status?: { completed?: boolean; status_str?: string; messages?: unknown[] };
    outputs?: Record<string, {
        images?: { filename: string; subfolder: string; type: string }[];
        gifs?: { filename: string; subfolder: string; type: string }[];
        videos?: { filename: string; subfolder: string; type: string }[];
    }>;
}

async function api(pathname: string, init?: RequestInit): Promise<Response> {
    return fetch(`${BASE}${pathname}`, init);
}

function readWorkflow(): Graph {
    // No file means the built-in default, not a refusal. Something that
    // works on a stock ComfyUI is worth more than an error telling you
    // to go and export a graph before you have seen a single picture.
    if (!fs.existsSync(WORKFLOW)) return structuredClone(DEFAULT_WORKFLOW) as unknown as Graph;
    try {
        return JSON.parse(fs.readFileSync(WORKFLOW, "utf8")) as Graph;
    } catch (e) {
        throw new EngineUnavailableError(
            `That ComfyUI workflow isn't valid JSON (${WORKFLOW}). Re-export it with Save (API format). `
            + (e instanceof Error ? e.message : ""),
        );
    }
}

function nodesOfClass(graph: Graph, className: string): string[] {
    return Object.keys(graph).filter((id) => graph[id]?.class_type === className);
}

/**
 * The node the sampler treats as the POSITIVE prompt.
 *
 * A workflow almost always has two CLIPTextEncode nodes and they look
 * identical; the only thing that tells them apart is which of the
 * sampler's inputs points at which. An input is `[nodeId, slot]`.
 */
function positivePromptNode(graph: Graph): string | null {
    for (const className of ["KSampler", "KSamplerAdvanced", "SamplerCustom"]) {
        for (const id of nodesOfClass(graph, className)) {
            const link = graph[id]?.inputs?.positive;
            if (Array.isArray(link) && typeof link[0] === "string") return link[0];
        }
    }
    // No sampler we recognise: fall back to the only text node, if there
    // is exactly one. Two, and guessing would be worse than refusing.
    const text = nodesOfClass(graph, "CLIPTextEncode");
    return text.length === 1 ? text[0] : null;
}

function applyJob(graph: Graph, request: GenerationRequest): Graph {
    const next: Graph = JSON.parse(JSON.stringify(graph)) as Graph;

    const promptNode = positivePromptNode(next);
    if (!promptNode) {
        throw new EngineUnavailableError(
            "Can't tell which node in that workflow takes the prompt. It needs a KSampler whose `positive` "
            + "input comes from a CLIPTextEncode, which is what every default text-to-image workflow has.",
        );
    }
    next[promptNode].inputs = { ...next[promptNode].inputs, text: request.prompt };

    // Seed, so the same prompt twice is two pictures rather than one
    // picture twice. Written to every sampler that has one.
    const seed = typeof request.params.seed === "number"
        ? request.params.seed
        : Math.floor(Math.random() * 2 ** 31);
    for (const className of ["KSampler", "KSamplerAdvanced", "SamplerCustom"]) {
        for (const id of nodesOfClass(next, className)) {
            const inputs = next[id].inputs ?? {};
            if ("seed" in inputs) inputs.seed = seed;
            if ("noise_seed" in inputs) inputs.noise_seed = seed;
            if (typeof request.params.steps === "number" && "steps" in inputs) inputs.steps = request.params.steps;
            next[id].inputs = inputs;
        }
    }

    // Size, only where the graph already has somewhere to put it.
    const { width, height } = request.params as { width?: number; height?: number };
    if (typeof width === "number" && typeof height === "number") {
        for (const id of nodesOfClass(next, "EmptyLatentImage")) {
            next[id].inputs = { ...next[id].inputs, width, height };
        }
    }

    return next;
}

/** Whichever of the three output shapes this workflow produced. */
function firstOutput(history: HistoryEntry): { filename: string; subfolder: string; type: string } | null {
    for (const node of Object.values(history.outputs ?? {})) {
        const found = node.images?.[0] ?? node.gifs?.[0] ?? node.videos?.[0];
        if (found) return found;
    }
    return null;
}

const POLL_MS = 1200;

export const comfyui: GenerationEngine = {
    id: "comfyui",
    label: "ComfyUI (on this machine)",
    // Stills only. ComfyUI can drive video models and the interface
    // still has a kind for it — what changed is the studio's mind about
    // what generation is FOR here: thumbnails and graphics, not
    // pretending to have filmed something.
    kinds: ["image"],
    where: "local",

    async check() {
        let res: Response;
        try {
            res = await api("/system_stats");
        } catch {
            throw new EngineUnavailableError(
                `ComfyUI isn't answering at ${BASE}. Start it, or set COMFYUI_URL in apps/server/.env if it `
                + "runs somewhere else.",
            );
        }
        if (!res.ok) {
            throw new EngineUnavailableError(`ComfyUI answered ${res.status} at ${BASE}.`);
        }
        // Reading the workflow is part of being usable: a running
        // ComfyUI with no graph to send it cannot make anything.
        readWorkflow();
    },

    async run(request: GenerationRequest): Promise<GenerationResult> {
        const graph = applyJob(readWorkflow(), request);
        const clientId = randomUUID();

        const queued = await api("/prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: graph, client_id: clientId }),
        });
        if (!queued.ok) {
            // ComfyUI reports a graph it won't accept in the body, and
            // that text is the only thing that says which node is wrong.
            const body = await queued.text().catch(() => "");
            throw new Error(`ComfyUI refused the workflow (${queued.status}). ${body.slice(0, 400)}`);
        }
        const { prompt_id: promptId } = (await queued.json()) as { prompt_id?: string };
        if (!promptId) throw new Error("ComfyUI accepted the workflow but returned no prompt id.");

        // Polling /history rather than the websocket: this runs on the
        // same machine, a job takes tens of seconds, and a socket would
        // add a reconnect path to maintain for a progress bar. The
        // percentage is coarse and says so — it is the queue position
        // turning into "running", not a step counter.
        let waited = 0;
        for (;;) {
            if (request.cancelled()) {
                // Stop the one that is actually running, and drop it
                // from the pending list if it hasn't started.
                await api("/interrupt", { method: "POST" }).catch(() => undefined);
                await api("/queue", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ delete: [promptId] }),
                }).catch(() => undefined);
                throw new Error("Cancelled.");
            }

            await new Promise((r) => setTimeout(r, POLL_MS));
            waited += POLL_MS;

            const res = await api(`/history/${promptId}`);
            if (!res.ok) continue;
            const history = (await res.json()) as Record<string, HistoryEntry>;
            const entry = history[promptId];

            if (!entry) {
                // Still queued or running inside ComfyUI. Creeps towards
                // 90 and stops: claiming 100 before the file exists is
                // the one number that would be a lie.
                request.onProgress(Math.min(90, (waited / 1000) * 3));
                continue;
            }

            const output = firstOutput(entry);
            if (!output) {
                const why = entry.status?.status_str;
                throw new Error(
                    why && why !== "success"
                        ? `ComfyUI finished with "${why}" and no output.`
                        : "ComfyUI finished but produced no image or video. Check that the workflow ends in a Save node.",
                );
            }

            const params = new URLSearchParams({
                filename: output.filename,
                subfolder: output.subfolder ?? "",
                type: output.type ?? "output",
            });
            const file = await api(`/view?${params.toString()}`);
            if (!file.ok) throw new Error(`ComfyUI made ${output.filename} but wouldn't hand it over (${file.status}).`);

            const bytes = Buffer.from(await file.arrayBuffer());
            if (bytes.length === 0) throw new Error(`ComfyUI returned ${output.filename} empty.`);

            request.onProgress(100);
            return { bytes, extension: path.extname(output.filename) || ".png" };
        }
    },
};

register(comfyui);
