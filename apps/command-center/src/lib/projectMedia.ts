import { projectFileUrl, type ProjectFile } from "./projectsApi";
import { readMetadata, type MediaAsset } from "../state/studioEditor";

/**
 * Turns the project's folder listing into media the editor can use.
 *
 * The file's NAME is the identity throughout: it is what the browser
 * plays from, what an export refers to, what a saved timeline points
 * at, and what you see in Finder. Nothing is uploaded and nothing is
 * copied — the same file serves all four.
 *
 * Duration and dimensions still have to be read by the browser, since
 * only it knows what it can decode; that read streams over the range
 * requests the server already supports rather than pulling whole files.
 */
export async function assetsFromFolder(projectId: number, files: ProjectFile[]): Promise<MediaAsset[]> {
    const out: MediaAsset[] = [];
    for (const file of files) {
        const url = projectFileUrl(projectId, file.name);
        const meta = await readMetadata(url, file.kind);
        out.push({
            id: `asset-${file.name}`,
            name: file.name,
            kind: file.kind,
            url,
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            frames: [],
            peaks: [],
            serverFile: file.name,
        });
    }
    return out;
}
