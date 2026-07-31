import { neuralNodes, neuralEdges, neuralPathD, neuralViewBox } from "../../state/neuralNetwork";
import "./NeuralCore.css";

/**
 * Renders the "living organism" texture inside the Brain — a brain-shaped
 * silhouette (blue-to-purple gradient glow) filled with a network of small
 * glowing nodes connected by synapse-like lines, each node flickering on
 * its own delay so the whole thing feels alive rather than mechanically
 * synchronized.
 *
 * All geometry (outline path, node positions, edges) lives in
 * state/neuralNetwork.ts as static pre-generated data — this component
 * only knows how to draw it.
 */
export default function NeuralCore() {
    return (
        <svg className="neural-core" viewBox={neuralViewBox}>

            <defs>

                <filter id="neural-blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="10" />
                </filter>

                <radialGradient id="neural-glow-gradient" cx="50%" cy="42%" r="65%">
                    <stop offset="0%" style={{ stopColor: "var(--primary)", stopOpacity: 0.55 }} />
                    <stop offset="55%" style={{ stopColor: "var(--accent)", stopOpacity: 0.35 }} />
                    <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
                </radialGradient>

            </defs>

            <g className="neural-pulse">

                <path
                    d={neuralPathD}
                    fill="url(#neural-glow-gradient)"
                    filter="url(#neural-blur)"
                />

                <g className="neural-edges">
                    {neuralEdges.map((edge) => {
                        const from = neuralNodes[edge.from];
                        const to = neuralNodes[edge.to];

                        return (
                            <line
                                key={`${edge.from}-${edge.to}`}
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                className="neural-edge"
                            />
                        );
                    })}
                </g>

                <g className="neural-nodes">
                    {neuralNodes.map((node) => (
                        <circle
                            key={node.id}
                            cx={node.x}
                            cy={node.y}
                            r={node.r}
                            className="neural-node"
                            style={{ animationDelay: `${node.delay}s` }}
                        />
                    ))}
                </g>

            </g>

        </svg>
    );
}