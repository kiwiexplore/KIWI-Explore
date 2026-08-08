import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import "./DetailDrawer.css";

const CARD_WIDTH = 340;
const MARGIN = 24; // kept clear of every viewport edge — "like a phone notification," never flush against the top/bottom.
// Used only for the placement math below (deciding whether the card
// fits below/right of the anchor) — deliberately close to the TYPICAL
// rendered height (short placeholder bodies), not the hard CSS cap
// (320px, for the rare long one, which just scrolls internally). Using
// the tall cap here made almost anything below the screen's vertical
// midpoint "not fit" and flip upward even when the actual card was
// nowhere near that tall.
const ESTIMATED_HEIGHT = 200;
const DEFAULT_MAX_HEIGHT = 320; // matches the CSS default — overridden per-content via maxHeight (e.g. SignUpForm needs more room)

export interface DetailDrawerContent {
    title: string;
    subtitle?: string;
    body: ReactNode;
    // Viewport coordinates (e.g. the clicked element's own center) the
    // card opens next to — this is what makes it appear where the thing
    // you clicked actually is, instead of always docking to a fixed
    // screen edge.
    anchor: { x: number; y: number };
    // Most bodies (widget summaries, module info) are short and fit
    // comfortably under the default cap — forms like SignUpForm need
    // more room to avoid an unnecessary internal scrollbar.
    maxHeight?: number;
    // Most cards are fine at the default width — content with real
    // paragraphs (InfoPanel's About page) reads better wider instead of
    // wrapping into a tall, narrow column.
    width?: number;
}

interface DetailDrawerProps {
    content: DetailDrawerContent | null;
    onClose: () => void;
}

/**
 * A floating detail card anchored to wherever the clicked widget/icon
 * actually is on screen — deliberately NOT a full-height side panel or a
 * full-screen modal. It opens in the free space right next to what you
 * clicked (to whichever side/direction of the anchor point has room),
 * always kept MARGIN clear of every viewport edge, so the brain (and
 * everything else) stays visible and nothing ever touches the screen's
 * edges.
 *
 * Placement always PREFERS the same direction (right and down from the
 * anchor) so it behaves identically everywhere on screen — it only
 * flips to the other side of the anchor when the preferred direction
 * would genuinely overflow past MARGIN. An earlier version decided the
 * direction from which half of the SCREEN the anchor was in, which flipped
 * every card in the bottom half to open upward even when there was
 * plenty of room below, reading as inconsistent with the top half.
 */
export default function DetailDrawer({ content, onClose }: DetailDrawerProps) {
    let style: CSSProperties = {};

    if (content) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const { x, y } = content.anchor;
        const width = content.width ?? CARD_WIDTH;
        const maxHeight = content.maxHeight ?? DEFAULT_MAX_HEIGHT;
        const estimatedHeight = Math.min(maxHeight, ESTIMATED_HEIGHT);

        const fitsRight = x + 16 + width <= vw - MARGIN;
        const fitsBelow = y + 16 + estimatedHeight <= vh - MARGIN;

        const left = fitsRight ? x + 16 : x - width - 16;
        const top = fitsBelow ? y + 16 : y - estimatedHeight - 16;

        style = {
            left: Math.min(Math.max(MARGIN, left), vw - width - MARGIN),
            top: Math.min(Math.max(MARGIN, top), vh - Math.min(maxHeight, vh - 2 * MARGIN) - MARGIN),
            width,
            maxHeight,
        };
    }

    return (
        <>
            <div
                className={`detail-drawer-scrim ${content ? "detail-drawer-scrim-visible" : ""}`}
                onClick={onClose}
            />
            <aside className={`detail-drawer ${content ? "detail-drawer-open" : ""}`} style={style}>
                {content && (
                    <>
                        <header className="detail-drawer-header">
                            <div>
                                <h2 className="detail-drawer-title">{content.title}</h2>
                                {content.subtitle && <p className="detail-drawer-subtitle">{content.subtitle}</p>}
                            </div>
                            <button type="button" className="detail-drawer-close" onClick={onClose} aria-label="Close">
                                <X size={18} strokeWidth={1.75} />
                            </button>
                        </header>
                        <div className="detail-drawer-body">{content.body}</div>
                    </>
                )}
            </aside>
        </>
    );
}
