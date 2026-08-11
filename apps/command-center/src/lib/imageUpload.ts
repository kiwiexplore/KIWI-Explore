import type { ImageAttachment } from "../state/laboratoryProjects";

/** Same FileReader -> data URL approach as ProfileSettings' avatar/background upload. */
export function readImageFile(file: File): Promise<ImageAttachment> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") resolve({ dataUrl: reader.result, mimeType: file.type });
            else reject(new Error("Could not read file"));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
