import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Clip, StudioEditorState } from "../../state/studioEditor";
import { formatClock } from "../../lib/timecode";
import "./StudioTimeline.css";

/** Seconds between ruler marks, picked so labels never crowd. */
function tickStep(pxPerSecond: number): number {
    for (const step of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) {
        if (step * pxPerSecond >= 90) return step;
    }
    return 900;
}

interface TimelineProps {
    editor: StudioEditorState;
    pxPerSecond: number;
}

/**
 * The timeline: six tracks, a ruler, a playhead, and clips you can
 * actually grab.
 *
 * Everything is positioned from SECONDS × pxPerSecond rather than held
 * as pixel state, so changing the zoom re-lays out the same edit
 * instead of nudging it. Dragging works on pointer events (not HTML5
 * drag-and-drop) because trimming needs a live delta on every move and
 * a drag image would only get in the way.
 */
export default function StudioTimeline({ editor, pxPerSecond }: TimelineProps) {
    const laneRef = useRef<HTMLDivElement>(null);
    // What the current pointer gesture is doing, kept in a ref: it
    // changes on every pointermove and nothing renders from it directly.
    const drag = useRef<{ kind: "move" | "start" | "end" | "scrub"; id: string; originX: number; originValue: number } | null>(null);

    const width = Math.max(editor.duration, 30) * pxPerSecond + 240;
    const step = tickStep(pxPerSecond);
    const ticks = Math.ceil(width / (step * pxPerSecond));

    const timeFromEvent = (clientX: number): number => {
        const lane = laneRef.current;
        if (!lane) return 0;
        const rect = lane.getBoundingClientRect();
        return Math.max(0, (clientX - rect.left + lane.scrollLeft) / pxPerSecond);
    };

    const beginDrag = (event: ReactPointerEvent, kind: "move" | "start" | "end", clip: Clip) => {
        event.stopPropagation();
        event.preventDefault();
        editor.selectClip(clip.id);
        drag.current = {
            kind,
            id: clip.id,
            originX: event.clientX,
            originValue: kind === "move" ? clip.start : kind === "start" ? clip.start : clip.duration,
        };
        (event.target as Element).setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: ReactPointerEvent) => {
        const state = drag.current;
        if (!state) return;
        const delta = (event.clientX - state.originX) / pxPerSecond;
        if (state.kind === "move") editor.moveClip(state.id, state.originValue + delta);
        else if (state.kind === "scrub") editor.setPlayhead(timeFromEvent(event.clientX));
        else {
            // Trim applies the FRAME's delta, not the accumulated one —
            // the state helper works in increments, so the origin is
            // re-based on every move.
            const clip = editor.clips.find((c) => c.id === state.id);
            if (!clip) return;
            const target = state.kind === "start"
                ? state.originValue + delta - clip.start
                : state.originValue + delta - clip.duration;
            editor.trimClip(state.id, state.kind, target);
        }
    };

    const endDrag = () => { drag.current = null; };

    const scrub = (event: ReactPointerEvent) => {
        drag.current = { kind: "scrub", id: "", originX: event.clientX, originValue: 0 };
        editor.setPlayhead(timeFromEvent(event.clientX));
    };

    return (
        <div className="studio-timeline">
            <div className="studio-timeline-heads">
                <div className="studio-timeline-corner" />
                {editor.tracks.map((track) => (
                    <div key={track.id} className={`studio-track-head studio-track-head-${track.kind}`}>
                        <span>{track.label}</span>
                        <span className="studio-track-dot" />
                    </div>
                ))}
            </div>

            <div
                className="studio-timeline-lanes"
                ref={laneRef}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
            >
                <div style={{ width, position: "relative" }}>
                    <div className="studio-ruler" onPointerDown={scrub}>
                        {Array.from({ length: ticks + 1 }, (_, i) => (
                            <span key={i} className="studio-tick" style={{ left: i * step * pxPerSecond }}>
                                {formatClock(i * step)}
                            </span>
                        ))}
                    </div>

                    {editor.tracks.map((track) => (
                        <div key={track.id} className={`studio-lane studio-lane-${track.kind}`}>
                            {editor.clips.filter((c) => c.trackId === track.id).map((clip) => {
                                const asset = editor.assets.find((a) => a.id === clip.assetId);
                                const selected = editor.selectedClipId === clip.id;
                                return (
                                    <div
                                        key={clip.id}
                                        className={`studio-clip studio-clip-${track.kind}${selected ? " studio-clip-selected" : ""}`}
                                        style={{ left: clip.start * pxPerSecond, width: Math.max(6, clip.duration * pxPerSecond) }}
                                        onPointerDown={(e) => beginDrag(e, "move", clip)}
                                    >
                                        {/* Handles only on the selected clip: six
                                            clips each showing grab targets is a
                                            wall of stripes, not an interface. */}
                                        {selected && (
                                            <span className="studio-clip-handle studio-clip-handle-start" onPointerDown={(e) => beginDrag(e, "start", clip)} />
                                        )}
                                        <span className="studio-clip-label">{asset?.name ?? "clip"}</span>
                                        {selected && (
                                            <span className="studio-clip-handle studio-clip-handle-end" onPointerDown={(e) => beginDrag(e, "end", clip)} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    <div className="studio-playhead" style={{ left: editor.playhead * pxPerSecond }}>
                        <span className="studio-playhead-grip" />
                    </div>
                </div>
            </div>
        </div>
    );
}
