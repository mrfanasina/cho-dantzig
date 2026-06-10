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


export function buildPath(predecessors: Record<string, string | null>, target: string) {
  const path: string[] = [];
  let current: string | null = target;

  const visited = new Set<string>(); // sécurité anti boucle

  while (current && !visited.has(current)) {
    visited.add(current);
    path.unshift(current);
    current = predecessors[current] ?? null;
  }

  return path;
}

export function buildPathFromLambda(target: string, lambdas: Record<string, number>, edges: GraphEdge[]) {
  const path = [target];
  let current = target;

  while (true) {
    const incomingEdges = edges.filter(e => e.to === current);

    const parentEdge = incomingEdges.find(e =>
      lambdas[current] === lambdas[e.from] + e.weight
    );

    if (!parentEdge) break;

    path.unshift(parentEdge.from);
    current = parentEdge.from;
  }

  return path;
}


// Trouver le dernier noeud d'un chemin optimal a partir de nodes et edges, si il 'est pas du tout le destionation d'autres noeuds, alors c'est lui le dernier noeud du chemin optimal(IL N'EST dans aucun to)
export function findSink(nodes: GraphNode[], edges: GraphEdge[]) {
  const sinkIds = new Set(nodes.map(n => n.id));
  edges.forEach(e => sinkIds.delete(e.from));
  return nodes.find(n => sinkIds.has(n.id));
}

//Trouver le chemin finale a partir de nodes et edges
