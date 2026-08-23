import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Text you change by clicking it.
 *
 * A project's name and its description are the two things most likely
 * to be wrong five minutes after you made it — you type something to
 * get past the box and then it is the name forever. A separate edit
 * screen for one field is more ceremony than the change deserves.
 *
 * Saves on blur and on Enter; Escape puts back what was there. It only
 * calls onSave when the text actually changed, so clicking in and out
 * of a field doesn't write to the database.
 */
export default function EditableText({ value, placeholder, onSave, className = "", multiline = false }: {
    value: string;
    placeholder: string;
    onSave: (value: string) => void;
    className?: string;
    multiline?: boolean;
}) {
    const [editing, setEditing] = useState(false);
    // Only meaningful while editing. Kept out of sync with `value` on
    // purpose: when you aren't typing, what's on screen IS `value`, so
    // there is nothing to keep in step and a refresh landing mid-edit
    // can't overwrite what you were writing.
    const [draft, setDraft] = useState("");
    const field = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const start = () => { setDraft(value); setEditing(true); };

    useEffect(() => {
        if (editing) field.current?.focus();
    }, [editing]);

    const commit = () => {
        setEditing(false);
        const next = draft.trim();
        if (next !== value.trim()) onSave(next);
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") { setEditing(false); return; }
        // Enter commits a single-line field. In a description it is a
        // new paragraph, which is what you want there.
        if (event.key === "Enter" && !multiline) { event.preventDefault(); commit(); }
    };

    if (!editing) {
        return (
            <button
                type="button"
                className={`et ${className}${value.trim() ? "" : " et-empty"}`}
                onClick={start}
                title="Click to edit"
            >
                {value.trim() || placeholder}
            </button>
        );
    }

    return multiline ? (
        <textarea
            ref={field as React.RefObject<HTMLTextAreaElement>}
            className={`et et-field ${className}`}
            value={draft}
            placeholder={placeholder}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
        />
    ) : (
        <input
            ref={field as React.RefObject<HTMLInputElement>}
            className={`et et-field ${className}`}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
        />
    );
}
