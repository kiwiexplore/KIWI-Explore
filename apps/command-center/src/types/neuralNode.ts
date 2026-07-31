export interface NeuralNode {
    id: number;
    x: number;
    y: number;
    r: number;
    delay: number;
}

export interface NeuralEdge {
    from: number;
    to: number;
}