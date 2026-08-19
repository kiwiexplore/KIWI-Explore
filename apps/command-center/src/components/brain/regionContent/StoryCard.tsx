import { useState, type ReactNode } from "react";

interface StoryCardProps {
    /** Where the story lives. Only used when the card is a plain link. */
    url?: string;
    title: string;
    /** A few sentences of what it's about — see the doc comment. */
    excerpt?: string;
    /** Source, score, category: whatever places the story. */
    meta?: string;
    image?: string | null;
    /** Sits outside the link — a save button, say. */
    action?: ReactNode;
    /**
     * Opens the story inside the panel (see StoryReader). With this the
     * card is a button and the link out moves to the reader, where you
     * decide after reading rather than before; without it the card is a
     * plain link straight to the source.
     */
    onOpen?: () => void;
}

/**
 * One story in a region panel: picture, headline, a couple of sentences,
 * and where it came from.
 *
 * The excerpt is the point of this (per explicit request). A list of
 * bare headlines makes you open a tab to find out whether a story was
 * worth opening a tab for — six times over, for six stories, most of
 * which weren't. Reading enough to decide belongs on this side of the
 * click, so every feed that carries a summary now shows it: Wikipedia's
 * article extracts for world news, the Spaceflight News API's own
 * summaries for space, TheMealDB's method for a recipe. Feeds that
 * genuinely carry no summary (Hacker News link posts) say what they do
 * have rather than padding it out with something invented.
 *
 * Images come straight from those same feeds and are hidden the moment
 * one fails to load, so a dead thumbnail can never leave a hole where a
 * story should be.
 */
export default function StoryCard({ url, title, excerpt, meta, image, action, onOpen }: StoryCardProps) {
    const [imageFailed, setImageFailed] = useState(false);

    const inside = (
        <>
            {image && !imageFailed && (
                <img
                    className="story-card-image"
                    src={image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    // NOT fetchPriority="low", which looked right and
                    // wasn't: deprioritised images on a tab that isn't in
                    // front are deferred more or less indefinitely, so
                    // the cards sat with empty squares. Some feeds do
                    // hand back the press-size original (the Spaceflight
                    // News API has no thumbnail field at all, so a
                    // 58-pixel picture there can cost a couple of
                    // megabytes) — but nothing waits on them: the card is
                    // laid out and readable before any image arrives.
                    //
                    // The feeds are read-only public sources; there's no
                    // reason to hand them this app's URL either.
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                />
            )}
            <span className="story-card-body">
                <span className="story-card-title">{title}</span>
                {excerpt && <span className="story-card-excerpt">{excerpt}</span>}
                {meta && <span className="story-card-meta">{meta}</span>}
            </span>
        </>
    );

    return (
        <div className="story-card">
            {onOpen ? (
                <button type="button" className="story-card-link" onClick={onOpen}>
                    {inside}
                </button>
            ) : (
                <a className="story-card-link" href={url} target="_blank" rel="noopener noreferrer">
                    {inside}
                </a>
            )}
            {action}
        </div>
    );
}
