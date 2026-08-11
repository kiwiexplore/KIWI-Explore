import { useRef, useState, type ChangeEvent } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";
import type { ImageAttachment } from "../../state/laboratoryProjects";
import { readImageFile } from "../../lib/imageUpload";
import QuickToolModal from "./QuickToolModal";
import "./ImageAttachmentField.css";

interface ImageUploadButtonProps {
    onUpload: (file: File, image: ImageAttachment) => void;
    className?: string;
    label?: string;
}

/** Hidden file input behind a small icon/label trigger — real upload, no drag-and-drop needed. */
export function ImageUploadButton({ onUpload, className, label }: ImageUploadButtonProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        readImageFile(file).then((image) => onUpload(file, image));
    };

    return (
        <>
            <button type="button" className={className ?? "image-attachment-upload-btn"} onClick={() => inputRef.current?.click()}>
                <Upload size={13} strokeWidth={2} />
                {label}
            </button>
            <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: "none" }} />
        </>
    );
}

interface ImageThumbnailProps {
    image: ImageAttachment;
    alt: string;
}

/** A small clickable thumbnail that opens a full-size preview in a QuickToolModal. */
export function ImageThumbnail({ image, alt }: ImageThumbnailProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" className="image-attachment-thumb" onClick={() => setOpen(true)} aria-label={`Preview ${alt}`}>
                <img src={image.dataUrl} alt={alt} />
            </button>
            {open && (
                <QuickToolModal title={alt} icon={ImageIcon} onClose={() => setOpen(false)}>
                    <img src={image.dataUrl} alt={alt} className="image-attachment-preview" />
                </QuickToolModal>
            )}
        </>
    );
}
