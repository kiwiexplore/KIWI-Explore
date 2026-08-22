import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// Personal-mode backend: single owner, no multi-tenant tables yet (see
// PROJECT_CONTEXT/memory on the agreed build order — auth/billing come
// later, around this core). SQLite via Node's own built-in node:sqlite
// (stable on this project's Node version) rather than a hosted
// Postgres/Supabase — that needs an account created on Supabase's own
// site, which isn't something this session can do on the user's behalf.
// Swapping to a hosted DB later just means changing this one file.

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "kiwi.db"));

// SQLite ships with foreign keys DISABLED and the setting is per
// connection, not stored in the file — without this line every
// REFERENCES clause below is decorative and orphaned rows go unnoticed.
// Nothing needed it until video_projects arrived (this was the first
// table in the schema with a real relationship).
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- Extracted key facts Kiwi recalls across sessions, instead of (or
    -- alongside) resending the full message history on every call —
    -- see src/memory.ts for how these get written and used.
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fact TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- Single row (id fixed at 1) — personal mode, one owner, one Spotify
    -- connection. Replaces the old browser-localStorage-only token
    -- storage so the connection survives across devices/browsers
    -- instead of each one needing its own separate PKCE dance.
    CREATE TABLE IF NOT EXISTS spotify_tokens (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- One row per provider (currently just 'google', covering both
    -- Calendar and YouTube — one OAuth consent grants both scopes at
    -- once, see routes/google.ts). Generic on purpose so a future
    -- provider doesn't need its own bespoke table like spotify_tokens
    -- above did before this pattern got extracted.
    CREATE TABLE IF NOT EXISTS oauth_tokens (
        provider TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- Laboratory's Content Hub — generated YouTube scripts/social posts
    -- (see src/contentGenerator.ts), plus a lightweight scheduling layer
    -- on top (status + scheduled_date) so a generated piece can be
    -- planned onto a publishing calendar without a separate table.
    CREATE TABLE IF NOT EXISTS content_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('youtube-script', 'instagram-post', 'tiktok-post', 'ad')),
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'scheduled', 'published')),
        scheduled_date TEXT,
        -- Set when this piece was generated FROM a video (an ad or a
        -- social post promoting it); NULL for standalone Content Hub
        -- pieces. See video_projects below, and the note there on why
        -- this is a typed FK rather than a generic parent_id.
        video_project_id INTEGER REFERENCES video_projects(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- Laboratory's Video Studio — one row per video being made, walked
    -- from idea through to published. Deliberately NOT folded into
    -- content_items: a content_item is one generated text with a
    -- publish lifecycle, whereas this is a production pipeline with a
    -- source file, a transcript, and several texts hanging off it.
    --
    -- The ads/social posts derived from a video live in content_items
    -- with video_project_id pointing back here, rather than in a
    -- polymorphic parent_id: SQLite cannot enforce an FK that might
    -- point at either table, so parent_id would be an unchecked integer
    -- and orphans would accumulate silently.
    -- Ideas, tracked trends, findings and loose notes. One table with a
    -- kind rather than four, because they are the same shape — a title
    -- and some text you keep — and four tables would mean four routes
    -- and four boards to say the same thing.
    --
    -- These used to be in-memory mock arrays hanging off a Laboratory
    -- project, which meant a reload emptied them. They also sat under a
    -- project, which stopped making sense once the Laboratory became a
    -- video studio: a trend you're watching isn't part of one project.
    -- A project is the thing you actually work on: a series, a channel
    -- run, a single film. Everything else hangs off it — the ideas you
    -- had for it, the videos you made from them.
    --
    -- video_projects came first and was, despite the name, one VIDEO.
    -- Renaming it now would break every route and every id in a running
    -- database; this table is the container those videos were always
    -- missing, and video_projects.project_id is the join.
    CREATE TABLE IF NOT EXISTS studio_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        -- A real folder on this machine. Media lives THERE, not in a
        -- database and not uploaded anywhere: the same arrangement every
        -- editor uses, where the project points at files and the files
        -- stay put. The cost is the same one DaVinci has — move a file
        -- and the project stops finding it — and it is worth paying to
        -- avoid copying hundreds of gigabytes into an app's own store.
        folder TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS lab_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('idea', 'trend', 'research', 'note')),
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        -- Which project this belongs to, or null for something you
        -- jotted down before it belonged anywhere.
        project_id INTEGER REFERENCES studio_projects(id) ON DELETE SET NULL,
        -- Ticked off. The one bit of state that makes a list of ideas
        -- into something you can work through.
        done INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS video_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT 'idea'
            CHECK (stage IN ('idea', 'script', 'recorded', 'transcribing', 'editing', 'published')),
        -- The content_item this video grew out of (today in practice a
        -- generated youtube-script). ON DELETE SET NULL so removing the
        -- script doesn't take the whole video project with it.
        source_content_id INTEGER REFERENCES content_items(id) ON DELETE SET NULL,
        -- The idea or tracked trend this video came out of. This is the
        -- link the whole thing was specified around; it needed the notes
        -- to exist server-side before it could point anywhere real.
        source_note_id INTEGER REFERENCES lab_notes(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES studio_projects(id) ON DELETE SET NULL,
        -- An absolute path to a file on the machine running this server
        -- — personal mode, and a raw recording is far too large to be
        -- worth pushing through a browser upload to a local backend.
        source_video_path TEXT,
        transcript_path TEXT,
        transcript_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (transcript_status IN ('pending', 'processing', 'done', 'failed')),
        -- Never empty when transcript_status is 'failed'. A silent
        -- failure is the one outcome this column exists to prevent.
        transcript_error TEXT,
        -- Last result of "Find clips" — a JSON array of
        -- {start, end, label, why}. Derived from the transcript, one
        -- per video, with no lifecycle of its own, so it rides here
        -- rather than earning a table.
        clips_json TEXT,
        -- The cut itself: tracks, clips, text, all in seconds. Stored
        -- as JSON because it is read and written whole and never
        -- queried into — a table of clips would buy nothing and cost a
        -- join on every save.
        timeline_json TEXT,
        -- What language the video is spoken in: an ISO 639-1 code, or
        -- 'auto' to let whisper work it out. This is NOT cosmetic —
        -- whisper.cpp's CLI defaults to English, so a Czech recording
        -- left unset gets transcribed as though it were English and
        -- comes out as nonsense that still reports success. It also
        -- tells the generators which language to write the script and
        -- the posts in.
        language TEXT NOT NULL DEFAULT 'auto',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
`);

// Migration for databases created before status/scheduled_date existed
// (CREATE TABLE IF NOT EXISTS above is a no-op against an existing
// table, so those columns need adding explicitly here instead).
const contentItemsColumns = db.prepare("PRAGMA table_info(content_items)").all() as { name: string }[];
if (!contentItemsColumns.some((c) => c.name === "status")) {
    db.exec("ALTER TABLE content_items ADD COLUMN status TEXT NOT NULL DEFAULT 'idea'");
}
if (!contentItemsColumns.some((c) => c.name === "scheduled_date")) {
    db.exec("ALTER TABLE content_items ADD COLUMN scheduled_date TEXT");
}
if (!contentItemsColumns.some((c) => c.name === "video_project_id")) {
    db.exec("ALTER TABLE content_items ADD COLUMN video_project_id INTEGER REFERENCES video_projects(id) ON DELETE SET NULL");
}

// Widening the `type` CHECK to allow 'ad' can't be done with ALTER —
// SQLite has no way to modify a constraint in place, so the only route
// is the documented rebuild: copy into a correctly-shaped table, drop
// the old one, rename. Guarded on the stored DDL so it runs at most
// once, and skipped entirely on a database created fresh above (which
// already has 'ad' in its CHECK).
//
// Foreign keys go off around it deliberately: dropping content_items
// while they're enforced would be seen as orphaning every video_project
// row that references it. The pragma can't be toggled inside a
// transaction, hence the ordering here.
// Databases created before language existed.
const videoColumns = db.prepare("PRAGMA table_info(video_projects)").all() as { name: string }[];
if (videoColumns.length > 0 && !videoColumns.some((c) => c.name === "language")) {
    db.exec("ALTER TABLE video_projects ADD COLUMN language TEXT NOT NULL DEFAULT 'auto'");
}
if (videoColumns.length > 0 && !videoColumns.some((c) => c.name === "source_note_id")) {
    db.exec("ALTER TABLE video_projects ADD COLUMN source_note_id INTEGER REFERENCES lab_notes(id) ON DELETE SET NULL");
}
if (videoColumns.length > 0 && !videoColumns.some((c) => c.name === "timeline_json")) {
    db.exec("ALTER TABLE video_projects ADD COLUMN timeline_json TEXT");
}
if (videoColumns.length > 0 && !videoColumns.some((c) => c.name === "project_id")) {
    db.exec("ALTER TABLE video_projects ADD COLUMN project_id INTEGER REFERENCES studio_projects(id) ON DELETE SET NULL");
}

const studioColumns = db.prepare("PRAGMA table_info(studio_projects)").all() as { name: string }[];
if (studioColumns.length > 0 && !studioColumns.some((c) => c.name === "folder")) {
    db.exec("ALTER TABLE studio_projects ADD COLUMN folder TEXT NOT NULL DEFAULT ''");
}

const noteColumns = db.prepare("PRAGMA table_info(lab_notes)").all() as { name: string }[];
if (noteColumns.length > 0 && !noteColumns.some((c) => c.name === "project_id")) {
    db.exec("ALTER TABLE lab_notes ADD COLUMN project_id INTEGER REFERENCES studio_projects(id) ON DELETE SET NULL");
}
if (noteColumns.length > 0 && !noteColumns.some((c) => c.name === "done")) {
    db.exec("ALTER TABLE lab_notes ADD COLUMN done INTEGER NOT NULL DEFAULT 0");
}

const contentItemsDDL = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'content_items'").get() as { sql?: string } | undefined)?.sql ?? "";
if (contentItemsDDL && !contentItemsDDL.includes("'ad'")) {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(`
        BEGIN;
        CREATE TABLE content_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK (type IN ('youtube-script', 'instagram-post', 'tiktok-post', 'ad')),
            topic TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'scheduled', 'published')),
            scheduled_date TEXT,
            video_project_id INTEGER REFERENCES video_projects(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        INSERT INTO content_items_new (id, type, topic, content, status, scheduled_date, video_project_id, created_at)
            SELECT id, type, topic, content, status, scheduled_date, video_project_id, created_at FROM content_items;
        DROP TABLE content_items;
        ALTER TABLE content_items_new RENAME TO content_items;
        COMMIT;
    `);
    db.exec("PRAGMA foreign_keys = ON");
}

export interface StoredMessage {
    id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

export function insertMessage(role: "user" | "assistant", content: string): StoredMessage {
    const stmt = db.prepare("INSERT INTO messages (role, content) VALUES (?, ?) RETURNING id, role, content, created_at");
    return stmt.get(role, content) as unknown as StoredMessage;
}

export function listMessages(limit = 100): StoredMessage[] {
    const stmt = db.prepare("SELECT id, role, content, created_at FROM messages ORDER BY id DESC LIMIT ?");
    return (stmt.all(limit) as unknown as StoredMessage[]).reverse();
}

export function clearMessages(): void {
    db.exec("DELETE FROM messages");
}

export interface StoredMemory {
    id: number;
    fact: string;
    created_at: string;
}

export function listMemories(): StoredMemory[] {
    const stmt = db.prepare("SELECT id, fact, created_at FROM memories ORDER BY id ASC");
    return stmt.all() as unknown as StoredMemory[];
}

export function insertMemory(fact: string): StoredMemory {
    const stmt = db.prepare("INSERT INTO memories (fact) VALUES (?) RETURNING id, fact, created_at");
    return stmt.get(fact) as unknown as StoredMemory;
}

export function clearMemories(): void {
    db.exec("DELETE FROM memories");
}

export interface StoredSpotifyTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

export function getSpotifyTokens(): StoredSpotifyTokens | null {
    const stmt = db.prepare("SELECT access_token, refresh_token, expires_at FROM spotify_tokens WHERE id = 1");
    const row = stmt.get() as unknown as { access_token: string; refresh_token: string; expires_at: number } | undefined;
    if (!row) return null;
    return { accessToken: row.access_token, refreshToken: row.refresh_token, expiresAt: row.expires_at };
}

export function saveSpotifyTokens(tokens: StoredSpotifyTokens): void {
    db.prepare(`
        INSERT INTO spotify_tokens (id, access_token, refresh_token, expires_at, updated_at)
        VALUES (1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT (id) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at
    `).run(tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
}

export function clearSpotifyTokens(): void {
    db.exec("DELETE FROM spotify_tokens");
}

export interface StoredOAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

export function getOAuthTokens(provider: string): StoredOAuthTokens | null {
    const stmt = db.prepare("SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE provider = ?");
    const row = stmt.get(provider) as unknown as { access_token: string; refresh_token: string; expires_at: number } | undefined;
    if (!row) return null;
    return { accessToken: row.access_token, refreshToken: row.refresh_token, expiresAt: row.expires_at };
}

export function saveOAuthTokens(provider: string, tokens: StoredOAuthTokens): void {
    db.prepare(`
        INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, updated_at)
        VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT (provider) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at
    `).run(provider, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
}

export function clearOAuthTokens(provider: string): void {
    db.prepare("DELETE FROM oauth_tokens WHERE provider = ?").run(provider);
}

export type ContentStatus = "idea" | "scheduled" | "published";

export interface StoredContentItem {
    id: number;
    type: "youtube-script" | "instagram-post" | "tiktok-post" | "ad";
    topic: string;
    content: string;
    status: ContentStatus;
    scheduled_date: string | null;
    video_project_id: number | null;
    created_at: string;
}

const CONTENT_ITEM_COLUMNS = "id, type, topic, content, status, scheduled_date, video_project_id, created_at";

export function listContentItems(): StoredContentItem[] {
    const stmt = db.prepare(`SELECT ${CONTENT_ITEM_COLUMNS} FROM content_items ORDER BY id DESC`);
    return stmt.all() as unknown as StoredContentItem[];
}

export function insertContentItem(
    type: StoredContentItem["type"],
    topic: string,
    content: string,
    // Set only when the piece was generated from a video (see
    // routes/video.ts); Content Hub's own generation leaves it null.
    videoProjectId: number | null = null,
): StoredContentItem {
    const stmt = db.prepare(`INSERT INTO content_items (type, topic, content, video_project_id) VALUES (?, ?, ?, ?) RETURNING ${CONTENT_ITEM_COLUMNS}`);
    return stmt.get(type, topic, content, videoProjectId) as unknown as StoredContentItem;
}

export function listContentItemsForVideo(videoProjectId: number): StoredContentItem[] {
    const stmt = db.prepare(`SELECT ${CONTENT_ITEM_COLUMNS} FROM content_items WHERE video_project_id = ? ORDER BY id DESC`);
    return stmt.all(videoProjectId) as unknown as StoredContentItem[];
}

export function getContentItem(id: number): StoredContentItem | null {
    const stmt = db.prepare(`SELECT ${CONTENT_ITEM_COLUMNS} FROM content_items WHERE id = ?`);
    return (stmt.get(id) as unknown as StoredContentItem) ?? null;
}

export interface ContentItemUpdate {
    status?: ContentStatus;
    scheduledDate?: string | null;
}

export function updateContentItem(id: number, update: ContentItemUpdate): StoredContentItem | null {
    if (update.status !== undefined) {
        db.prepare("UPDATE content_items SET status = ? WHERE id = ?").run(update.status, id);
    }
    if (update.scheduledDate !== undefined) {
        db.prepare("UPDATE content_items SET scheduled_date = ? WHERE id = ?").run(update.scheduledDate, id);
    }
    const stmt = db.prepare(`SELECT ${CONTENT_ITEM_COLUMNS} FROM content_items WHERE id = ?`);
    return (stmt.get(id) as unknown as StoredContentItem) ?? null;
}

export function deleteContentItem(id: number): void {
    db.prepare("DELETE FROM content_items WHERE id = ?").run(id);
}

export type VideoStage = "idea" | "script" | "recorded" | "transcribing" | "editing" | "published";

export const VIDEO_STAGES: VideoStage[] = ["idea", "script", "recorded", "transcribing", "editing", "published"];

export type TranscriptStatus = "pending" | "processing" | "done" | "failed";

export interface StoredVideoProject {
    id: number;
    title: string;
    stage: VideoStage;
    source_content_id: number | null;
    source_note_id: number | null;
    project_id: number | null;
    source_video_path: string | null;
    transcript_path: string | null;
    transcript_status: TranscriptStatus;
    transcript_error: string | null;
    clips_json: string | null;
    timeline_json: string | null;
    language: string;
    created_at: string;
    updated_at: string;
}

const VIDEO_PROJECT_COLUMNS = `
    id, title, stage, source_content_id, source_note_id, project_id, source_video_path,
    transcript_path, transcript_status, transcript_error, clips_json, timeline_json, language,
    created_at, updated_at
`;

const TOUCH_UPDATED_AT = "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export function listVideoProjects(): StoredVideoProject[] {
    const stmt = db.prepare(`SELECT ${VIDEO_PROJECT_COLUMNS} FROM video_projects ORDER BY id DESC`);
    return stmt.all() as unknown as StoredVideoProject[];
}

export function getVideoProject(id: number): StoredVideoProject | null {
    const stmt = db.prepare(`SELECT ${VIDEO_PROJECT_COLUMNS} FROM video_projects WHERE id = ?`);
    return (stmt.get(id) as unknown as StoredVideoProject) ?? null;
}

export function insertVideoProject(title: string, sourceContentId: number | null = null): StoredVideoProject {
    const stmt = db.prepare(`INSERT INTO video_projects (title, source_content_id) VALUES (?, ?) RETURNING ${VIDEO_PROJECT_COLUMNS}`);
    return stmt.get(title, sourceContentId) as unknown as StoredVideoProject;
}

export interface VideoProjectUpdate {
    title?: string;
    stage?: VideoStage;
    sourceContentId?: number | null;
    sourceNoteId?: number | null;
    projectId?: number | null;
    sourceVideoPath?: string | null;
    language?: string;
}

/**
 * Only the fields a person edits directly. Everything transcript-shaped
 * moves through the dedicated helpers below instead, so no caller can
 * set transcript_status without also setting the path/error that has to
 * go with it.
 */
export function updateVideoProject(id: number, update: VideoProjectUpdate): StoredVideoProject | null {
    if (update.title !== undefined) {
        db.prepare(`UPDATE video_projects SET title = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.title, id);
    }
    if (update.stage !== undefined) {
        db.prepare(`UPDATE video_projects SET stage = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.stage, id);
    }
    if (update.sourceContentId !== undefined) {
        db.prepare(`UPDATE video_projects SET source_content_id = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.sourceContentId, id);
    }
    if (update.sourceNoteId !== undefined) {
        db.prepare(`UPDATE video_projects SET source_note_id = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.sourceNoteId, id);
    }
    if (update.projectId !== undefined) {
        db.prepare(`UPDATE video_projects SET project_id = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.projectId, id);
    }
    if (update.sourceVideoPath !== undefined) {
        db.prepare(`UPDATE video_projects SET source_video_path = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.sourceVideoPath, id);
    }
    if (update.language !== undefined) {
        db.prepare(`UPDATE video_projects SET language = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.language, id);
    }
    return getVideoProject(id);
}

export function deleteVideoProject(id: number): void {
    db.prepare("DELETE FROM video_projects WHERE id = ?").run(id);
}

/**
 * Records what whisper actually heard, once. Only fills in a project
 * left on 'auto' — a language somebody chose by hand is theirs to keep,
 * even if the detector disagrees.
 */
export function saveDetectedLanguage(id: number, language: string): void {
    db.prepare("UPDATE video_projects SET language = ? WHERE id = ? AND language = 'auto'").run(language, id);
}

export function saveTimeline(id: number, timelineJson: string): void {
    db.prepare(`UPDATE video_projects SET timeline_json = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(timelineJson, id);
}

export function saveVideoClips(id: number, clipsJson: string): StoredVideoProject | null {
    db.prepare(`UPDATE video_projects SET clips_json = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(clipsJson, id);
    return getVideoProject(id);
}

// --- Transcript state transitions -------------------------------------
//
// Kept together, and as the only writers of transcript_status, because
// the invariant they enforce is easy to break by hand: 'failed' ALWAYS
// carries an error, 'done' ALWAYS carries a path, and neither ever
// leaves a stale value from the previous attempt behind. A transcript
// that quietly ends up empty while claiming success is the exact
// outcome this table was shaped to make impossible.

export function markTranscriptProcessing(id: number): void {
    db.prepare(`
        UPDATE video_projects
        SET transcript_status = 'processing', transcript_error = NULL, transcript_path = NULL,
            stage = 'transcribing', ${TOUCH_UPDATED_AT}
        WHERE id = ?
    `).run(id);
}

/**
 * Advances stage to 'editing' only when it's still 'transcribing' —
 * i.e. only when nobody moved it by hand while the job was running.
 */
export function markTranscriptDone(id: number, transcriptPath: string): void {
    db.prepare(`
        UPDATE video_projects
        SET transcript_status = 'done', transcript_path = ?, transcript_error = NULL,
            stage = CASE WHEN stage = 'transcribing' THEN 'editing' ELSE stage END,
            ${TOUCH_UPDATED_AT}
        WHERE id = ?
    `).run(transcriptPath, id);
}

/**
 * Drops stage back to 'recorded': the video demonstrably has no
 * transcript, so leaving the pipeline reading 'transcribing' would be a
 * quieter lie than the red badge this puts on the card.
 */
export function markTranscriptFailed(id: number, error: string): void {
    db.prepare(`
        UPDATE video_projects
        SET transcript_status = 'failed', transcript_error = ?, transcript_path = NULL,
            stage = CASE WHEN stage = 'transcribing' THEN 'recorded' ELSE stage END,
            ${TOUCH_UPDATED_AT}
        WHERE id = ?
    `).run(error, id);
}

/**
 * Run once at boot. A crash or a restart mid-job leaves rows sitting in
 * 'processing' with no process behind them, and the UI would spin on
 * them forever — which would make 'processing' a fifth, silent failure
 * state. Returns how many were swept so startup can say so out loud.
 */
export function failInterruptedTranscripts(): number {
    const stuck = db.prepare("SELECT id FROM video_projects WHERE transcript_status = 'processing'").all() as unknown as { id: number }[];
    for (const row of stuck) {
        markTranscriptFailed(row.id, "Transcription was interrupted — the server restarted while it was running. Run it again.");
    }
    return stuck.length;
}

export type LabNoteKind = "idea" | "trend" | "research" | "note";

export const LAB_NOTE_KINDS: LabNoteKind[] = ["idea", "trend", "research", "note"];

export interface StoredLabNote {
    id: number;
    kind: LabNoteKind;
    title: string;
    body: string;
    project_id: number | null;
    done: number;
    created_at: string;
    updated_at: string;
}

const LAB_NOTE_COLUMNS = "id, kind, title, body, project_id, done, created_at, updated_at";

export function listLabNotes(kind?: LabNoteKind): StoredLabNote[] {
    const stmt = kind
        ? db.prepare(`SELECT ${LAB_NOTE_COLUMNS} FROM lab_notes WHERE kind = ? ORDER BY id DESC`)
        : db.prepare(`SELECT ${LAB_NOTE_COLUMNS} FROM lab_notes ORDER BY id DESC`);
    return (kind ? stmt.all(kind) : stmt.all()) as unknown as StoredLabNote[];
}

export function getLabNote(id: number): StoredLabNote | null {
    const stmt = db.prepare(`SELECT ${LAB_NOTE_COLUMNS} FROM lab_notes WHERE id = ?`);
    return (stmt.get(id) as unknown as StoredLabNote) ?? null;
}

export function insertLabNote(kind: LabNoteKind, title: string, body = "", projectId: number | null = null): StoredLabNote {
    const stmt = db.prepare(`INSERT INTO lab_notes (kind, title, body, project_id) VALUES (?, ?, ?, ?) RETURNING ${LAB_NOTE_COLUMNS}`);
    return stmt.get(kind, title, body, projectId) as unknown as StoredLabNote;
}

export function listLabNotesForProject(projectId: number): StoredLabNote[] {
    const stmt = db.prepare(`SELECT ${LAB_NOTE_COLUMNS} FROM lab_notes WHERE project_id = ? ORDER BY done ASC, id DESC`);
    return stmt.all(projectId) as unknown as StoredLabNote[];
}

export interface LabNoteUpdate {
    title?: string;
    body?: string;
    projectId?: number | null;
    done?: boolean;
}

export function updateLabNote(id: number, update: LabNoteUpdate): StoredLabNote | null {
    if (update.title !== undefined) {
        db.prepare(`UPDATE lab_notes SET title = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.title, id);
    }
    if (update.body !== undefined) {
        db.prepare(`UPDATE lab_notes SET body = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.body, id);
    }
    if (update.projectId !== undefined) {
        db.prepare(`UPDATE lab_notes SET project_id = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.projectId, id);
    }
    if (update.done !== undefined) {
        db.prepare(`UPDATE lab_notes SET done = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.done ? 1 : 0, id);
    }
    return getLabNote(id);
}

export function deleteLabNote(id: number): void {
    db.prepare("DELETE FROM lab_notes WHERE id = ?").run(id);
}

export interface StoredStudioProject {
    id: number;
    title: string;
    description: string;
    folder: string;
    created_at: string;
    updated_at: string;
}

const STUDIO_PROJECT_COLUMNS = "id, title, description, folder, created_at, updated_at";

export function listStudioProjects(): StoredStudioProject[] {
    const stmt = db.prepare(`SELECT ${STUDIO_PROJECT_COLUMNS} FROM studio_projects ORDER BY id DESC`);
    return stmt.all() as unknown as StoredStudioProject[];
}

export function getStudioProject(id: number): StoredStudioProject | null {
    const stmt = db.prepare(`SELECT ${STUDIO_PROJECT_COLUMNS} FROM studio_projects WHERE id = ?`);
    return (stmt.get(id) as unknown as StoredStudioProject) ?? null;
}

export function insertStudioProject(title: string, description = "", folder = ""): StoredStudioProject {
    const stmt = db.prepare(`INSERT INTO studio_projects (title, description, folder) VALUES (?, ?, ?) RETURNING ${STUDIO_PROJECT_COLUMNS}`);
    return stmt.get(title, description, folder) as unknown as StoredStudioProject;
}

export function updateStudioProject(id: number, update: { title?: string; description?: string; folder?: string }): StoredStudioProject | null {
    if (update.title !== undefined) {
        db.prepare(`UPDATE studio_projects SET title = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.title, id);
    }
    if (update.description !== undefined) {
        db.prepare(`UPDATE studio_projects SET description = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.description, id);
    }
    if (update.folder !== undefined) {
        db.prepare(`UPDATE studio_projects SET folder = ?, ${TOUCH_UPDATED_AT} WHERE id = ?`).run(update.folder, id);
    }
    return getStudioProject(id);
}

/**
 * Deleting a project keeps its videos and notes, with their project_id
 * set to null. Losing a finished film because the folder it was in went
 * away would be indefensible.
 */
export function deleteStudioProject(id: number): void {
    db.prepare("DELETE FROM studio_projects WHERE id = ?").run(id);
}

export function listVideoProjectsForProject(projectId: number): StoredVideoProject[] {
    const stmt = db.prepare(`SELECT ${VIDEO_PROJECT_COLUMNS} FROM video_projects WHERE project_id = ? ORDER BY id DESC`);
    return stmt.all(projectId) as unknown as StoredVideoProject[];
}
