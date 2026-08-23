import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

/**
 * A project's folder on this machine.
 *
 * Media stays where it is put — the project points at files, the files
 * do not move into a database or an upload store. That is how every
 * editor works, and it is the only arrangement that survives a hundred
 * gigabytes of footage.
 *
 * The trade is the same one DaVinci makes: move a file and the project
 * stops finding it. The alternative is copying everything twice, which
 * costs disk and time on every import and still breaks when the copy
 * goes stale.
 */

/** Where new project folders are made. Override in apps/server/.env. */
const ROOT = process.env.KIWI_MEDIA_ROOT || path.join(os.homedir(), "KIWI Studio");

const MEDIA_EXTENSIONS = new Set([
    ".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi",
    ".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg",
    ".png", ".jpg", ".jpeg", ".webp", ".gif",
]);

/** Keeps a title usable as a folder name without inventing a new one. */
function safeFolderName(title: string): string {
    const cleaned = title.trim().replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 80);
    return cleaned || "Untitled project";
}

/**
 * Makes the project's folder, avoiding collisions rather than merging
 * into somebody else's: two projects called "Trailer" sharing one
 * folder would silently pool their footage.
 */
export function createProjectFolder(title: string): string {
    fs.mkdirSync(ROOT, { recursive: true });
    const base = safeFolderName(title);
    let folder = path.join(ROOT, base);
    let n = 2;
    while (fs.existsSync(folder)) {
        folder = path.join(ROOT, `${base} ${n}`);
        n += 1;
    }
    fs.mkdirSync(folder, { recursive: true });
    // Somewhere obvious for exports, so a render never lands among the
    // rushes.
    fs.mkdirSync(path.join(folder, "Exports"), { recursive: true });
    return folder;
}

export interface ProjectFile {
    name: string;
    bytes: number;
    kind: "video" | "audio" | "image";
    modifiedAt: string;
}

function kindOf(extension: string): ProjectFile["kind"] | null {
    if ([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"].includes(extension)) return "video";
    if ([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"].includes(extension)) return "audio";
    if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) return "image";
    return null;
}

/**
 * What's in the folder right now. Read fresh every time rather than
 * indexed: the whole point is that you can drop a file in from Finder
 * and have it be there.
 */
export function listProjectFiles(folder: string): ProjectFile[] {
    if (!folder || !fs.existsSync(folder)) return [];
    const out: ProjectFile[] = [];
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (!entry.isFile() || entry.name.startsWith(".")) continue;
        const extension = path.extname(entry.name).toLowerCase();
        if (!MEDIA_EXTENSIONS.has(extension)) continue;
        const kind = kindOf(extension);
        if (!kind) continue;
        const stat = fs.statSync(path.join(folder, entry.name));
        out.push({ name: entry.name, bytes: stat.size, kind, modifiedAt: stat.mtime.toISOString() });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether the studio reads this kind of file at all. */
export function isMediaName(name: string): boolean {
    return MEDIA_EXTENSIONS.has(path.extname(name).toLowerCase());
}

/**
 * A name nothing is using yet.
 *
 * An upload must never quietly replace footage an existing cut points
 * at — the timeline refers to files by NAME, so overwriting one would
 * silently change what an edit plays.
 */
export function freeName(folder: string, name: string): string {
    const extension = path.extname(name);
    const stem = name.slice(0, name.length - extension.length);
    let candidate = name;
    let n = 2;
    while (fs.existsSync(path.join(folder, candidate))) {
        candidate = `${stem} ${n}${extension}`;
        n += 1;
    }
    return candidate;
}

/**
 * Resolves a file inside the project's folder, refusing anything that
 * would climb out of it. The name arrives from a URL, so this is the
 * boundary — a path that resolves outside the folder is rejected rather
 * than normalised into something surprising.
 */
export function resolveProjectFile(folder: string, name: string): string | null {
    if (!folder) return null;
    const full = path.resolve(folder, name);
    const root = path.resolve(folder);
    if (full !== root && !full.startsWith(root + path.sep)) return null;
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
    return full;
}

/** Everything in the folder, including Exports and anything the studio
 *  doesn't recognise — this is what deleting it would actually take. */
export function folderWeight(folder: string): { files: number; bytes: number } {
    if (!folder || !fs.existsSync(folder)) return { files: 0, bytes: 0 };
    let files = 0;
    let bytes = 0;
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile()) { files += 1; bytes += fs.statSync(full).size; }
        }
    };
    walk(folder);
    return { files, bytes };
}

/**
 * Moves the project's folder to the Trash.
 *
 * Through Finder rather than fs.rmSync, and that is the whole point:
 * this is the only act in the studio that touches footage somebody had
 * to go outside and film, and it has to be the kind of mistake you can
 * take back. rm would be one keystroke away from losing a shoot.
 *
 * Refuses to touch anything that isn't inside the media root, so a
 * project whose folder was pointed somewhere strange can't take a home
 * directory with it.
 */
export async function trashProjectFolder(folder: string): Promise<void> {
    if (!folder || !fs.existsSync(folder)) return;

    const full = path.resolve(folder);
    const root = path.resolve(ROOT);
    if (full === root || !full.startsWith(root + path.sep)) {
        throw new Error(`Refusing to delete ${full}: it isn't inside ${root}.`);
    }

    await new Promise<void>((resolve, reject) => {
        // POSIX file, not an alias or a path string: Finder resolves
        // the others differently and would silently do nothing.
        const child = spawn("osascript", [
            "-e", `tell application "Finder" to delete POSIX file ${JSON.stringify(full)}`,
        ]);
        let stderr = "";
        child.stderr.on("data", (chunk) => { stderr += String(chunk); });
        child.on("error", reject);
        child.on("close", (code) => (code === 0
            ? resolve()
            : reject(new Error(`Could not move the folder to the Trash. ${stderr.trim()}`))));
    });
}

export { ROOT as MEDIA_ROOT };
