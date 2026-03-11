import { useState } from "react";
import type { GraphNode, GraphEdge } from "../types/graph";
import { INITIAL_NODES, INITIAL_EDGES } from "../constants/graphConstants";

export function useGraph() {

  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [edges] = useState<GraphEdge[]>(INITIAL_EDGES);

  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  return {
    nodes,
    edges,
    dragging,
    selected,
    hovered,
    setNodes,
    setDragging,
    setSelected,
    setHovered
  };
}