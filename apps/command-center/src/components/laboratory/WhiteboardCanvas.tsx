import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser, PenTool, Save } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import QuickToolModal from "./QuickToolModal";
import "./QuickToolModal.css";
import "./WhiteboardCanvas.css";

interface WhiteboardCanvasProps {
    projects: LaboratoryProject[];
    onClose: () => void;
    onAddFile: (projectId: string, name: string) => void;
}

let sketchCounter = 0;

/**
 * A real freehand drawing pad (canvas + pointer events, no library) —
 * "Save to Files" tracks a filename in project.files, same honest
 * "no real upload/backend" pattern the Files module already uses
 * (see ProjectFile's own comment); it doesn't actually export the
 * pixels anywhere, there's nowhere for them to go yet.
 */
export default function WhiteboardCanvas({ projects, onClose, onAddFile }: WhiteboardCanvasProps) {
    const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    const getContext = () => canvasRef.current?.getContext("2d") ?? null;

    const pointerToCanvasCoords = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (canvas.width / rect.width),
            y: (event.clientY - rect.top) * (canvas.height / rect.height),
        };
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const ctx = getContext();
        if (!ctx) return;
        drawingRef.current = true;
        const { x, y } = pointerToCanvasCoords(event);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const ctx = getContext();
        if (!ctx) return;
        const { x, y } = pointerToCanvasCoords(event);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "#eaf6ff";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        drawingRef.current = false;
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleSave = () => {
        if (!selectedId || !hasDrawn) return;
        sketchCounter += 1;
        onAddFile(selectedId, `whiteboard-sketch-${sketchCounter}.png`);
        handleClear();
    };

    return (
        <QuickToolModal
            title="Whiteboard"
            icon={PenTool}
            onClose={onClose}
            headerExtra={projects.length > 0 ? (
                <select
                    className="quick-tool-modal-project-select"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    aria-label="Save sketches to project"
                >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            ) : undefined}
        >
            {projects.length === 0 ? (
                <div className="quick-tool-modal-empty">No projects yet — create one first.</div>
            ) : (
                <div className="whiteboard-body">
                    <canvas
                        ref={canvasRef}
                        className="whiteboard-canvas"
                        width={1000}
                        height={560}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={stopDrawing}
                        onPointerLeave={stopDrawing}
                    />
                    <div className="whiteboard-actions">
                        <button type="button" className="whiteboard-action-btn" onClick={handleClear} disabled={!hasDrawn}>
                            <Eraser size={14} strokeWidth={2} />
                            Clear
                        </button>
                        <button type="button" className="whiteboard-action-btn whiteboard-action-save" onClick={handleSave} disabled={!hasDrawn}>
                            <Save size={14} strokeWidth={2} />
                            Save to Files
                        </button>
                    </div>
                </div>
            )}
        </QuickToolModal>
    );
}
