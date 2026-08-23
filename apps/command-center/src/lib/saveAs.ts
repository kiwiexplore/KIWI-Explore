/**
 * Putting a finished render where the person wants it.
 *
 * The render happens on the server and lands in the project's Exports
 * folder — that has to keep happening, because "is there an export"
 * is the gate between editing and publishing and it is answered by
 * looking on disk. This is the copy that goes wherever you say.
 *
 * showSaveFilePicker is the real macOS save dialog, and where it isn't
 * available the browser's own download is the same act with the folder
 * chosen once in the browser's settings instead of every time. Neither
 * path can fail quietly: a cancelled dialog is not an error and says
 * so, and anything else is reported.
 */

export type SaveOutcome = "saved" | "downloaded" | "cancelled";

interface FilePickerOptions {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
}
interface WritableFile { write(data: Blob): Promise<void>; close(): Promise<void> }
interface FileHandle { createWritable(): Promise<WritableFile> }

/** Chromium only, today. Absent everywhere else, hence the fallback. */
function picker(): ((options: FilePickerOptions) => Promise<FileHandle>) | null {
    const fn = (window as unknown as { showSaveFilePicker?: (o: FilePickerOptions) => Promise<FileHandle> })
        .showSaveFilePicker;
    return typeof fn === "function" ? fn.bind(window) : null;
}

export function canPickFolder(): boolean {
    return picker() !== null;
}

/**
 * Fetches the rendered file and writes it where the dialog says.
 *
 * The bytes come through the browser rather than being copied
 * server-side, because the server has no idea what folder you picked —
 * the dialog hands out a handle, never a path.
 */
export async function saveRenderAs(url: string, suggestedName: string): Promise<SaveOutcome> {
    const show = picker();

    if (show) {
        let handle: FileHandle;
        try {
            handle = await show({
                suggestedName,
                types: [{ description: "MP4 video", accept: { "video/mp4": [".mp4"] } }],
            });
        } catch (e) {
            // A cancelled dialog throws AbortError. It is not a failure
            // and must not be reported as one.
            if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
            throw e;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not read the rendered file (${res.status}).`);
        const writable = await handle.createWritable();
        await writable.write(await res.blob());
        await writable.close();
        return "saved";
    }

    // No dialog: hand it to the browser, which puts it wherever
    // downloads go. Same file, one less choice.
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return "downloaded";
}
