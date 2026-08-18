import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Types for the JS handler next door, so the dashboard's TypeScript
 * Vite config can mount it without a suppression comment.
 */
export declare function handleFeedRequest(
    req: IncomingMessage,
    res: ServerResponse,
): Promise<boolean>;
