import { useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { Clip, MediaAsset, StudioEditorState, TrackKind } from "../../state/studioEditor";
import { formatClock } from "../../lib/timecode";
import "./StudioTimeline.css";

/** Seconds between ruler marks, picked so labels never crowd. */
function tickStep(pxPerSecond: number): number {
    for (const step of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) {
        if (step * pxPerSecond >= 90) return step;
    }
    return 900;
}

/** How close a drag has to get before it lands flush, in pixels. */
const SNAP_PX = 7;

function snapTo(value: number, points: number[], pxPerSecond: number): number {
    let best = value;
    let bestDistance = SNAP_PX / pxPerSecond;
    for (const point of points) {
        const distance = Math.abs(point - value);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = point;
        }
    }
    return best;
}

/**
 * A clip's own body: the filmstrip for video, the peak envelope for
 * audio.
 *
 * Both are drawn from the slice of the SOURCE the clip actually uses —
 * offset to offset+duration — so trimming a clip reveals and hides real
 * frames rather than squashing one picture.
 */
function ClipBody({ clip, asset, trackKind }: { clip: Clip; asset: MediaAsset | undefined; trackKind: TrackKind }) {
    if (!asset) return null;

    // What a clip draws is decided by the TRACK it sits on, not by the
    // file: the same video dropped onto A1 is there for its sound, and
    // showing it a filmstrip would answer a question nobody asked.
    const wantsWave = trackKind === "audio" || asset.frames.length === 0;

    if (wantsWave && asset.peaks.length > 0) {
        const from = asset.duration > 0 ? clip.offset / asset.duration : 0;
        const to = asset.duration > 0 ? (clip.offset + clip.duration) / asset.duration : 1;
        const slice = asset.peaks.slice(
            Math.floor(from * asset.peaks.length),
            Math.max(Math.floor(from * asset.peaks.length) + 1, Math.floor(to * asset.peaks.length)),
        );
        return (
            <svg className="studio-clip-wave" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                {slice.map((peak, i) => {
                    const x = (i / Math.max(1, slice.length - 1)) * 100;
                    const h = Math.max(1, peak * 34);
                    return <rect key={i} x={x} y={20 - h / 2} width={100 / Math.max(1, slice.length)} height={h} />;
                })}
            </svg>
        );
    }

    if (wantsWave || asset.frames.length === 0) return null;

    return (
        <div className="studio-clip-strip" aria-hidden="true">
            {asset.frames.map((frame, i) => (
                <span key={i} style={{ backgroundImage: `url(${frame})` }} />
            ))}
        </div>
    );
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
 * a drag image would only get in the way — the one exception is
 * dropping in from the media bin, which IS an HTML5 drag because it
 * starts in another component.
 */
export default function StudioTimeline({ editor, pxPerSecond }: TimelineProps) {
    const laneRef = useRef<HTMLDivElement>(null);
    // What the current pointer gesture is doing, kept in a ref: it
    // changes on every pointermove and nothing renders from it directly.
    const drag = useRef<{ kind: "move" | "start" | "end" | "scrub"; id: string; originX: number; originValue: number } | null>(null);
    // The guide line shown while a drag is landing on a snap point.
    const [snapAt, setSnapAt] = useState<number | null>(null);
    const [dropTrack, setDropTrack] = useState<string | null>(null);

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
        // One history entry per gesture, taken before anything moves.
        editor.beginGesture();
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

        if (state.kind === "scrub") {
            editor.setPlayhead(timeFromEvent(event.clientX));
            return;
        }

        const clip = editor.clips.find((c) => c.id === state.id);
        if (!clip) return;
        const points = editor.snapPoints(state.id);

        if (state.kind === "move") {
            const raw = Math.max(0, state.originValue + delta);
            // Both edges look for a snap, so a clip lands flush whether
            // you dragged its head or its tail to the join.
            const head = snapTo(raw, points, pxPerSecond);
            const tail = snapTo(raw + clip.duration, points, pxPerSecond) - clip.duration;
            const landed = Math.abs(head - raw) <= Math.abs(tail - raw) ? head : tail;
            setSnapAt(landed !== raw ? (Math.abs(head - raw) <= Math.abs(tail - raw) ? landed : landed + clip.duration) : null);
            editor.moveClip(state.id, landed);
            return;
        }

        // Trim applies the FRAME's delta, not the accumulated one — the
        // state helper works in increments, so the origin is re-based
        // on every move.
        const wanted = state.kind === "start"
            ? snapTo(state.originValue + delta, points, pxPerSecond)
            : snapTo(clip.start + state.originValue + delta, points, pxPerSecond) - clip.start;
        setSnapAt(state.kind === "start" ? wanted : clip.start + wanted);
        editor.trimClip(state.id, state.kind, state.kind === "start" ? wanted - clip.start : wanted - clip.duration);
    };

    const endDrag = () => { drag.current = null; setSnapAt(null); };

    const scrub = (event: ReactPointerEvent) => {
        drag.current = { kind: "scrub", id: "", originX: event.clientX, originValue: 0 };
        editor.setPlayhead(timeFromEvent(event.clientX));
    };

    const onDropAsset = (event: DragEvent, trackId: string) => {
        event.preventDefault();
        setDropTrack(null);
        const assetId = event.dataTransfer.getData("application/x-kiwi-asset");
        if (!assetId) return;
        const at = snapTo(timeFromEvent(event.clientX), editor.snapPoints(), pxPerSecond);
        editor.addClip(assetId, trackId, at);
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
                        <div
                            key={track.id}
                            className={`studio-lane studio-lane-${track.kind}${dropTrack === track.id ? " studio-lane-drop" : ""}`}
                            onDragOver={(e) => { e.preventDefault(); setDropTrack(track.id); }}
                            onDragLeave={() => setDropTrack((t) => (t === track.id ? null : t))}
                            onDrop={(e) => onDropAsset(e, track.id)}
                        >
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
                                        <ClipBody clip={clip} asset={asset} trackKind={track.kind} />
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

                    {snapAt !== null && (
                        <div className="studio-snapline" style={{ left: snapAt * pxPerSecond }} aria-hidden="true" />
                    )}

                    <div className="studio-playhead" style={{ left: editor.playhead * pxPerSecond }}>
                        <span className="studio-playhead-grip" />
                    </div>
                </div>
            </div>
        </div>
    );
}
