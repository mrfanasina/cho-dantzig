import type { GraphEdge, GraphNode } from "../types/graph";
import { NODE_RADIUS } from "../constants/graphConstants";

export function getNode(nodes: GraphNode[], id: string) {
  return nodes.find((n) => n.id === id);
}

export function getEdgePath(nodes: GraphNode[], edge: GraphEdge) {

  const from = getNode(nodes, edge.from);
  const to = getNode(nodes, edge.to);

  if (!from || !to) return "";

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const len = Math.sqrt(dx * dx + dy * dy);

  const nx = dx / len;
  const ny = dy / len;

  const x1 = from.x + nx * NODE_RADIUS;
  const y1 = from.y + ny * NODE_RADIUS;

  const x2 = to.x - nx * NODE_RADIUS;
  const y2 = to.y - ny * NODE_RADIUS;

  const mx = (x1 + x2) / 2 - ny * 20;
  const my = (y1 + y2) / 2 + nx * 20;

  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

export function getMidpoint(nodes: GraphNode[], edge: GraphEdge) {

  const from = getNode(nodes, edge.from);
  const to = getNode(nodes, edge.to);

  if (!from || !to) return { x: 0, y: 0 };

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const len = Math.sqrt(dx * dx + dy * dy);

  const nx = -dy / len;
  const ny = dx / len;

  return {
    x: (from.x + to.x) / 2 + nx * 20,
    y: (from.y + to.y) / 2 + ny * 20,
  };
}