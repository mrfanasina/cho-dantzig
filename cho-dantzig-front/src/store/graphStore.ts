import { create } from "zustand";
import type { DantzigResult, DantzigStep, GraphNode, GraphEdge, ApiGraph } from "../types/graph";
import { graphService } from "../services/graphService";
import { INITIAL_NODES, INITIAL_EDGES } from "../constants/graphConstants";
import { buildPath } from "../utils/graphUtils";
import ELK from "elkjs/lib/elk.bundled.js";

interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  addNode: (node: GraphNode) => void;
  addEdge: (edge: GraphEdge) => void;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => void;
  /**
   * Convenience action used by GraphCanvas to change a single edge's weight
   * (e.g. inline editing of the weight badge). Previously GraphCanvas called
   * a function with this exact name that didn't exist on the store, so
   * weight edits silently did nothing — this action fixes that.
   */
  updateEdgeWeight: (id: string, weight: number) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;

  canvasWidth: number;
  canvasHeight: number;

  setCanvasSize: (width: number, height: number) => void;
  
  sourceNode: string | null;
  setSourceNode: (id: string | null) => void;

  optimizationType: "min" | "max";
  setOptimizationType: (type: "min" | "max") => void;

  isRunning: boolean;
  isComputed: boolean;
  result: DantzigResult | null;
  currentStepIndex: number;
  totalSteps: number;

  executeDantzig: () => Promise<void>;
  resetResult: () => void;

  setCurrentStepIndex: (index: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToFirstStep: () => void;
  goToLastStep: () => void;

  error: string | null;
  clearError: () => void;

  getCurrentStep: () => DantzigStep | null;
  getNodeLambda: (nodeId: string) => number | null;
  isNodeMarked: (nodeId: string) => boolean;
  isCurrentNode: (nodeId: string) => boolean;
  isSelectedEdge: (from: string, to: string) => boolean;
  isNodeInOptimalPath: (nodeId: string) => boolean;
  isEdgeInOptimalPath: (from: string, to: string) => boolean;

  arrangeGraph: () => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: INITIAL_NODES,
  edges: INITIAL_EDGES,
  canvasWidth: 800,
  canvasHeight: 600,

  setCanvasSize: (width, height) =>
    set({
      canvasWidth: width,
      canvasHeight: height,
    }),
    
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  addEdge: (edge) => set((state) => ({ edges: [...state.edges, edge] })),
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map((n) => n.id === id ? { ...n, ...updates } : n)
  })),
  updateEdge: (id, updates) => set((state) => ({
    edges: state.edges.map((e) => e.id === id ? { ...e, ...updates } : e)
  })),
  // Fix: GraphCanvas's inline weight editor calls `updateEdgeWeight`, which
  // never existed before — edits to an edge's weight were silently dropped.
  // Implemented as a thin wrapper around `updateEdge` so both stay consistent.
  updateEdgeWeight: (id, weight) => get().updateEdge(id, { weight }),
  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== id),
    edges: state.edges.filter((e) => e.from !== id && e.to !== id)
  })),
  removeEdge: (id) => set((state) => ({
    edges: state.edges.filter((e) => e.id !== id)
  })),
  moveNode: (id, x, y) =>
  set((state) => ({
    nodes: state.nodes.map((n) =>
      n.id === id
        ? { ...n, x, y }
        : n
    ),
  })),

  sourceNode: INITIAL_NODES[0]?.id || null,
  setSourceNode: (id) => set({ sourceNode: id }),

  optimizationType: "min",
  setOptimizationType: (type) => set({ optimizationType: type }),

  isRunning: false,
  isComputed: false,
  result: null,
  currentStepIndex: 0,
  totalSteps: 0,

  error: null,
  clearError: () => set({ error: null }),

  executeDantzig: async () => {
    const { nodes, edges, sourceNode, optimizationType } = get();
    
    set({ isRunning: true, error: null });

    try {
      const apiGraph: ApiGraph = {
        nodes: nodes.map((n) => n.id),
        edges: edges.map((e) => ({
          from: e.from,
          to: e.to,
          weight: e.weight,
        })),
      };

      const response = await graphService.runDantzig(apiGraph, sourceNode || undefined, optimizationType);

      if (!response.success || !response.data) {
        throw new Error(response.message || "Erreur lors de l'exécution");
      }

      const result = response.data;
      console.log("DANTZIG RESULT =", result);

      // ── Injection des étapes de révélation du chemin optimal ──────────────
      // On ajoute des étapes synthétiques APRÈS les étapes Dantzig normales.
      // Chaque étape révèle un arc supplémentaire, en remontant du nœud
      // final vers la source (pathRevealCount arcs révélés depuis la fin).
      if (result.optimalPath?.path && result.optimalPath.path.length >= 2) {
        const path: string[] = result.optimalPath.path;
        const lastStep = result.steps[result.steps.length - 1];

        // k = path.length-1 → 1 : on remonte arc par arc depuis la fin
        for (let k = path.length - 1; k >= 1; k--) {
          (result.steps as any[]).push({
            iteration: result.steps.length,
            description: `Remontée chemin : ${path[k - 1]} → ${path[k]}`,
            currentNode: undefined,
            lambdas: { ...lastStep.lambdas },
            markedNodes: [...lastStep.markedNodes],
            // Nombre d'arcs révélés depuis la fin (1, 2, …, path.length-1)
            pathRevealCount: path.length - k,
          });
        }
      }

      set({
        isRunning: false,
        isComputed: true,
        result,
        currentStepIndex: 0,
        totalSteps: result.steps.length,
      });
    } catch (error) {
      set({
        isRunning: false,
        error: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    }
  },

  resetResult: () => set({
    isComputed: false,
    result: null,
    currentStepIndex: 0,
    totalSteps: 0,
    error: null,
  }),

  setCurrentStepIndex: (index) => {
    const { totalSteps } = get();
    if (index >= 0 && index < totalSteps) {
      set({ currentStepIndex: index });
    }
  },

  goToNextStep: () => {
    const { currentStepIndex, totalSteps } = get();
    if (currentStepIndex < totalSteps - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    }
  },

  goToPreviousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  goToFirstStep: () => set({ currentStepIndex: 0 }),

  goToLastStep: () => {
    const { totalSteps } = get();
    if (totalSteps > 0) {
      set({ currentStepIndex: totalSteps - 1 });
    }
  },

  getCurrentStep: () => {
    try {
      const { result, currentStepIndex } = get();
      if (!result?.steps || !Array.isArray(result.steps)) return null;
      return result.steps[currentStepIndex] || null;
    } catch (e) {
      return null;
    }
  },

  getNodeLambda: (nodeId) => {
    try {
      const step = get().getCurrentStep();
      if (!step || !step.lambdas) return null;
      const lambda = step.lambdas[nodeId];
      if (lambda === undefined || lambda === null || lambda === Infinity) return null;
      return lambda;
    } catch (e) {
      return null;
    }
  },

  isNodeMarked: (nodeId) => {
    try {
      const step = get().getCurrentStep();
      if (!step || !step.markedNodes || !Array.isArray(step.markedNodes)) return false;
      return step.markedNodes.includes(nodeId);
    } catch (e) {
      return false;
    }
  },

  isCurrentNode: (nodeId) => {
    try {
      const step = get().getCurrentStep();
      return step?.currentNode === nodeId;
    } catch (e) {
      return false;
    }
  },

  isSelectedEdge: (from, to) => {
    try {
      const step = get().getCurrentStep();
      if (!step?.selectedEdge) return false;
      return step.selectedEdge.from === from && step.selectedEdge.to === to;
    } catch (e) {
      return false;
    }
  },

  isNodeInOptimalPath: (nodeId) => {
    const { result, currentStepIndex } = get();
    if (!result?.optimalPath?.path) return false;

    const step = (result.steps as any[])[currentStepIndex];
    if (step?.pathRevealCount === undefined) return false;

    const path = result.optimalPath.path;
    // Les (pathRevealCount + 1) derniers nœuds du chemin sont révélés
    const revealedNodes = path.slice(path.length - step.pathRevealCount - 1);
    return revealedNodes.includes(nodeId);
  },

  isEdgeInOptimalPath: (from, to) => {
    const { result, currentStepIndex } = get();
    if (!result?.optimalPath?.path) return false;

    const step = (result.steps as any[])[currentStepIndex];
    if (step?.pathRevealCount === undefined) return false;

    const path = result.optimalPath.path;
    // Révèle les (pathRevealCount) derniers arcs du chemin
    const startIdx = path.length - 1 - step.pathRevealCount;
    for (let i = Math.max(0, startIdx); i < path.length - 1; i++) {
      if (path[i] === from && path[i + 1] === to) return true;
    }
    return false;
  },

  arrangeGraph: () => {
    const { nodes, edges, sourceNode, canvasWidth, canvasHeight } = get();
    if (!nodes.length) return;

    import("d3-force").then(({
      forceSimulation,
      forceLink,
      forceManyBody,
      forceCenter,
      forceCollide,
      forceX,
      forceY,
    }) => {
      const source = sourceNode ?? nodes[0].id;

      // ── BFS pour niveau horizontal ──────────────────────────────────────
      const adj: Record<string, string[]> = {};
      nodes.forEach(n => { adj[n.id] = []; });
      edges.forEach(e => {
        adj[e.from]?.push(e.to);
        adj[e.to]?.push(e.from); // non-dirigé pour le layout
      });

      const bfsLevel: Record<string, number> = { [source]: 0 };
      const queue = [source];
      while (queue.length) {
        const cur = queue.shift()!;
        (adj[cur] ?? []).forEach(nb => {
          if (bfsLevel[nb] === undefined) {
            bfsLevel[nb] = bfsLevel[cur] + 1;
            queue.push(nb);
          }
        });
      }
      nodes.forEach(n => { if (bfsLevel[n.id] === undefined) bfsLevel[n.id] = 0; });

      const maxLevel = Math.max(...Object.values(bfsLevel), 1);

      const MARGIN_X = 100;
      const MARGIN_Y = 80;
      const usableW = canvasWidth - MARGIN_X * 2;
      const usableH = canvasHeight - MARGIN_Y * 2;

      // Position initiale : grille propre basée sur le niveau BFS
      const levelCounts: Record<number, number> = {};
      const levelIndex: Record<string, number> = {};
      nodes.forEach(n => {
        const l = bfsLevel[n.id];
        levelIndex[n.id] = levelCounts[l] ?? 0;
        levelCounts[l] = (levelCounts[l] ?? 0) + 1;
      });

      const simNodes = nodes.map(n => {
        const l = bfsLevel[n.id];
        const idx = levelIndex[n.id];
        const total = levelCounts[l];
        return {
          id: n.id,
          x: MARGIN_X + (l / maxLevel) * usableW,
          y: MARGIN_Y + ((idx + 0.5) / total) * usableH,
        };
      });

      const simLinks = edges.map(e => ({
        source: e.from,
        target: e.to,
      }));

      // ── Simulation ──────────────────────────────────────────────────────
      const simulation = forceSimulation(simNodes)
        .force("link", forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(130)
          .strength(0.5)
        )
        .force("charge", forceManyBody()
          .strength(-600)
          .distanceMax(500)
        )
        .force("center", forceCenter(canvasWidth / 2, canvasHeight / 2)
          .strength(0.02)
        )
        .force("collide", forceCollide(55).strength(1).iterations(4))
        .force("x", forceX((d: any) => {
          const l = bfsLevel[d.id] ?? 0;
          return MARGIN_X + (l / maxLevel) * usableW;
        }).strength(0.7))
        .force("y", forceY(canvasHeight / 2).strength(0.01))
        .alphaDecay(0.015)
        .velocityDecay(0.35)
        .stop();

      const iterations = Math.ceil(
        Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())
      );
      for (let i = 0; i < iterations; i++) simulation.tick();

      // ── Recentrage sans scale ──────────────────────────────────────────
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      simNodes.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      const offsetX = MARGIN_X - minX;
      const offsetY = MARGIN_Y - minY;

      const graphW = maxX - minX;
      const graphH = maxY - minY;
      const scaleX = graphW > usableW ? usableW / graphW : 1;
      const scaleY = graphH > usableH ? usableH / graphH : 1;
      const scale = Math.min(scaleX, scaleY);

      const finalOffsetX = scale < 1
        ? (canvasWidth - graphW * scale) / 2 - minX * scale
        : offsetX;
      const finalOffsetY = scale < 1
        ? (canvasHeight - graphH * scale) / 2 - minY * scale
        : offsetY;

      const newNodes = nodes.map(n => {
        const sim = simNodes.find(p => p.id === n.id);
        if (!sim) return n;
        return {
          ...n,
          x: sim.x * scale + finalOffsetX,
          y: sim.y * scale + finalOffsetY,
        };
      });

      set({ nodes: newNodes });
    });
  },
}));