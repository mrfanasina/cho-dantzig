import type { GraphNode, GraphEdge } from "../types/graph";

export const INITIAL_NODES: GraphNode[] = [
  { id: "s", label: "S", x: 120, y: 240, type: "source", lambda: 0 },
  { id: "a", label: "A", x: 300, y: 120, type: "normal", lambda: 4 },
  { id: "b", label: "B", x: 300, y: 360, type: "normal", lambda: 3 },
  { id: "c", label: "C", x: 500, y: 120, type: "normal", lambda: 6 },
  { id: "d", label: "D", x: 500, y: 360, type: "normal", lambda: 9 },
  { id: "t", label: "T", x: 680, y: 240, type: "sink", lambda: 12 },
];

export const INITIAL_EDGES: GraphEdge[] = [
  { id: "e1", from: "s", to: "a", weight: 4, flow: 0 },
  { id: "e2", from: "s", to: "b", weight: 3, flow: 0 },
  { id: "e3", from: "a", to: "c", weight: 2, flow: 0 },
  { id: "e4", from: "a", to: "d", weight: 5, flow: 0 },
  { id: "e5", from: "b", to: "d", weight: 6, flow: 0 },
  { id: "e6", from: "c", to: "t", weight: 3, flow: 0 },
  { id: "e7", from: "d", to: "t", weight: 4, flow: 0 },
];

export const NODE_RADIUS = 22;

export const GRAPH_WIDTH = 800;
export const GRAPH_HEIGHT = 500;