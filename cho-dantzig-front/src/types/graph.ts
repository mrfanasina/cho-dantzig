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
  lambda?: number;
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