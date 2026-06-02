type NodeType = "source" | "sink" | "normal";

export type Node = {
  id: string
  x: number
  y: number
  label: string
}

export type Edge = {
  id: string
  source: string
  target: string
  weight: number
}

export type Graph = {
  nodes: Node[]
  edges: Edge[]
}

export interface GraphNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  type: NodeType;
  lambda?: number | null;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  flow: number;
}

export interface NodeColors {
  fill: string;
  stroke: string;
  text: string;
}

export interface ApiGraph {
  nodes: string[];
  edges: ApiGraphEdge[];
}

export interface ApiGraphEdge {
  from: string;
  to: string;
  weight: number;
}

export interface DantzigStep {
  iteration: number;
  description: string;
  lambdas: Record<string, number>;
  markedNodes: string[];
  currentNode: string | null;
  selectedEdge: { from: string; to: string; weight: number } | null;
  explanation: string;
}

export interface OptimalPath {
  from: string;
  to: string;
  path: string[];
}

export interface DantzigResult {
  initialLambdas: Record<string, number>;
  steps: DantzigStep[];
  finalLambdas: Record<string, number>;
  markedNodes: string[];
  predecessors: Record<string, string | null>;
  optimalPaths: OptimalPath[];
  sourceNode: string;
  nodes: Array<{ id: string; [key: string]: any }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}