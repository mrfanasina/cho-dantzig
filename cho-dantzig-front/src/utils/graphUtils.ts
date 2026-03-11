import type { GraphNode, GraphEdge } from "../types/graph";

export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width = 800,
  height = 500
): GraphNode[] {

  const layers: Record<string, number> = {};
  const source = nodes.find(n => n.type === "source");

  if (!source) return nodes;

  const queue = [source.id];
  layers[source.id] = 0;

  while (queue.length) {
    const id = queue.shift()!;

    edges
      .filter(e => e.from === id)
      .forEach(e => {
        if (layers[e.to] === undefined) {
          layers[e.to] = layers[id] + 1;
          queue.push(e.to);
        }
      });
  }

  const groups: Record<number, GraphNode[]> = {};

  nodes.forEach(n => {
    const layer = layers[n.id] ?? 0;

    if (!groups[layer]) groups[layer] = [];

    groups[layer].push(n);
  });

  const maxLayer = Math.max(...Object.keys(groups).map(Number));
  const xSpacing = width / (maxLayer + 1);

  const result: GraphNode[] = [];

  Object.entries(groups).forEach(([layerStr, group]) => {

    const layer = Number(layerStr);
    const ySpacing = height / (group.length + 1);

    group.forEach((node, i) => {

      result.push({
        ...node,
        x: layer * xSpacing + 100,
        y: (i + 1) * ySpacing
      });

    });

  });

  return result;
}