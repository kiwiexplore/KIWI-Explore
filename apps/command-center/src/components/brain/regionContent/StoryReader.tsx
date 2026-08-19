import { useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";

/** A labelled figure — an ingredient and its measure, a launch pad. */
export interface StoryFact {
    label: string;
    value: string;
}

export interface StoryDetail {
    title: string;
    /** Source, date, category — whatever places the story. */
    subtitle?: string;
    image?: string | null;
    /** The main text, in full. Blank lines become paragraphs. */
    body?: string;
    facts?: StoryFact[];
    /** Where the whole thing lives, if it lives anywhere. */
    url?: string;
    /** "Read on ESA", "Open the recipe" — names the destination. */
    sourceLabel?: string;
}

interface StoryReaderProps {
    story: StoryDetail;
    /** Names the level behind this one: "News", "Space", "Meals". */
    backLabel: string;
    onBack: () => void;
    /** Anything module-specific — the save button, on a recipe. */
    children?: ReactNode;
}

/**
 * One story, opened inside the panel.
 *
 * The third level of the region panel (see BrainRegionPanel for the
 * first two), and the reason it exists: a card in a list can only show
 * three lines before the list stops being a list, so the full summary,
 * the picture at a size worth looking at, and everything the feed
 * carries alongside them had nowhere to go. Leaving the app was the
 * only way to read any of it.
 *
 * Nothing here is fetched — every field comes from the same response
 * the list was built from, so opening a story costs nothing and works
 * offline once the list has loaded. The link out is the LAST thing on
 * the page rather than the whole interaction: you decide here, and go
 * to the source only if it's worth it.
 *
 * Deliberately not a modal. The panel keeps its place on screen and the
 * brain behind it is never covered — same rule as the two levels above.
 */
export default function StoryReader({ story, backLabel, onBack, children }: StoryReaderProps) {
    const [imageFailed, setImageFailed] = useState(false);
    const paragraphs = (story.body ?? "").split(/\n{2,}|\r\n\r\n/).map((part) => part.trim()).filter(Boolean);

    return (
        <div className="story-reader">
            <button type="button" className="story-reader-back" onClick={onBack}>
                <ArrowLeft size={13} strokeWidth={2} />
                {backLabel}
            </button>

            {story.image && !imageFailed && (
                <img
                    className="story-reader-image"
                    src={story.image}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                />
            )}

            <h3 className="story-reader-title">{story.title}</h3>
            {story.subtitle && <p className="story-reader-subtitle">{story.subtitle}</p>}

            {paragraphs.map((paragraph, index) => (
                <p key={index} className="story-reader-body">{paragraph}</p>
            ))}

            {story.facts && story.facts.length > 0 && (
                <ul className="module-list story-reader-facts">
                    {story.facts.map((fact) => (
                        <li key={fact.label} className="module-row">
                            <span className="module-row-lead">{fact.label}</span>
                            <span>{fact.value}</span>
                        </li>
                    ))}
                </ul>
            )}

            {children}

            {story.url && (
                <a className="story-reader-source" href={story.url} target="_blank" rel="noopener noreferrer">
                    {story.sourceLabel ?? "Open the source"}
                    <ExternalLink size={13} strokeWidth={2} />
                </a>
            )}
        </div>
    );
}
