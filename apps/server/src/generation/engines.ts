import type { JobKind } from "../db.js";

/**
 * What a generation engine has to be able to do, and nothing more.
 *
 * One interface with two methods is the whole point of the queue being
 * separate from what runs it. Adding Kling or Runway later means one
 * file in this folder and one line in the registry below — no migration,
 * no change to the queue, no change to any screen.
 *
 * The contract is deliberately narrow:
 *
 *   check()     — is this engine usable right now? Answered BEFORE a job
 *                 is accepted, so "ComfyUI isn't running" is a clear
 *                 refusal at the moment you press the button rather than
 *                 a job that goes to 'failed' a second later.
 *   run()       — do the work, report progress, return the bytes.
 *
 * run() returns BYTES rather than writing a file. Where the output goes
 * is the queue's business — it lands in the project's folder, under a
 * name nothing else is using — and an engine that picked its own path
 * would be able to disagree with that.
 */

export class EngineUnavailableError extends Error {}

export interface GenerationRequest {
    kind: JobKind;
    prompt: string;
    /** Engine-specific. Each adapter reads what it understands. */
    params: Record<string, unknown>;
    /** 0..100, called as often as the engine has something to say. */
    onProgress: (percent: number) => void;
    /** Resolves when the job has been cancelled; adapters race it. */
    cancelled: () => boolean;
}

export interface GenerationResult {
    bytes: Buffer;
    /** File extension including the dot, decided by what came back. */
    extension: string;
}

export interface GenerationEngine {
    /** The value stored in generation_jobs.engine. */
    id: string;
    label: string;
    /** Which kinds this one can make at all. */
    kinds: JobKind[];
    /** Where it runs, said plainly for the screen that lists engines. */
    where: "local" | "cloud";
    check(): Promise<void>;
    run(request: GenerationRequest): Promise<GenerationResult>;
}

const registry = new Map<string, GenerationEngine>();

export function register(engine: GenerationEngine): void {
    registry.set(engine.id, engine);
}

export function getEngine(id: string): GenerationEngine | null {
    return registry.get(id) ?? null;
}

export function listEngines(): GenerationEngine[] {
    return [...registry.values()];
}
