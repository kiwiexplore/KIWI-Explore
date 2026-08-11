import { useState } from "react";
import { Network } from "lucide-react";
import type { LaboratoryProject } from "../../state/laboratoryProjects";
import QuickToolModal from "./QuickToolModal";
import "./QuickToolModal.css";
import "./MindMapView.css";

interface MindMapViewProps {
    projects: LaboratoryProject[];
    onClose: () => void;
}

const WIDTH = 500;
const HEIGHT = 340;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = 140;

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * A read-only radial diagram of one project's ideas (project.ideas —
 * the exact same data IdeasBoard manages), branching out from the
 * project name at the center. Real data, not a fabricated diagram —
 * just a different way of looking at what's already tracked. No
 * drag/edit here; capture and editing already happen in Ideas.
 */
export default function MindMapView({ projects, onClose }: MindMapViewProps) {
    const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
    const project = projects.find((p) => p.id === selectedId) ?? null;
    const ideas = project?.ideas ?? [];

    return (
        <QuickToolModal
            title="Mind Map"
            icon={Network}
            onClose={onClose}
            headerExtra={projects.length > 0 ? (
                <select
                    className="quick-tool-modal-project-select"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    aria-label="Project"
                >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            ) : undefined}
        >
            {!project ? (
                <div className="quick-tool-modal-empty">No projects yet — create one first.</div>
            ) : ideas.length === 0 ? (
                <div className="quick-tool-modal-empty">
                    No ideas captured for {project.name} yet — add some from the Ideas section.
                </div>
            ) : (
                <svg className="mind-map-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%">
                    {ideas.map((idea, i) => {
                        const angle = (i / ideas.length) * Math.PI * 2 - Math.PI / 2;
                        const x = CENTER_X + Math.cos(angle) * RADIUS;
                        const y = CENTER_Y + Math.sin(angle) * RADIUS;
                        return (
                            <line
                                key={`line-${idea.id}`}
                                x1={CENTER_X} y1={CENTER_Y} x2={x} y2={y}
                                className="mind-map-edge"
                            />
                        );
                    })}

                    {ideas.map((idea, i) => {
                        const angle = (i / ideas.length) * Math.PI * 2 - Math.PI / 2;
                        const x = CENTER_X + Math.cos(angle) * RADIUS;
                        const y = CENTER_Y + Math.sin(angle) * RADIUS;
                        return (
                            <g key={idea.id} transform={`translate(${x}, ${y})`}>
                                <circle r={5} className="mind-map-node-dot" />
                                <foreignObject x={-70} y={10} width={140} height={44}>
                                    <div className="mind-map-node-label">{truncate(idea.text, 60)}</div>
                                </foreignObject>
                            </g>
                        );
                    })}

                    <g transform={`translate(${CENTER_X}, ${CENTER_Y})`}>
                        <circle r={34} className="mind-map-center-dot" />
                        <foreignObject x={-60} y={-11} width={120} height={22}>
                            <div className="mind-map-center-label">{project.name}</div>
                        </foreignObject>
                    </g>
                </svg>
            )}
        </QuickToolModal>
    );
}
