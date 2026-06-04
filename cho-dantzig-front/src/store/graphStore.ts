import { create } from "zustand";
import type { DantzigResult, DantzigStep, GraphNode, GraphEdge, ApiGraph } from "../types/graph";
import { graphService } from "../services/graphService";
import { INITIAL_NODES, INITIAL_EDGES } from "../constants/graphConstants";

interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  addNode: (node: GraphNode) => void;
  addEdge: (edge: GraphEdge) => void;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => void;
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
    try {
      const { result, currentStepIndex, totalSteps } = get();
      if (!result?.optimalPaths || totalSteps === 0) return false;
      
      if (currentStepIndex < totalSteps - 1) return false;

      return result.optimalPaths.some(path => 
        path.path.includes(nodeId)
      );
    } catch (e) {
      return false;
    }
  },

  isEdgeInOptimalPath: (from, to) => {
    try {
      const { result, currentStepIndex, totalSteps } = get();
      if (!result?.optimalPaths || totalSteps === 0) return false;
      
      if (currentStepIndex < totalSteps - 1) return false;

      return result.optimalPaths.some(path => {
        for (let i = 0; i < path.path.length - 1; i++) {
          if (path.path[i] === from && path.path[i + 1] === to) {
            return true;
          }
        }
        return false;
      });
    } catch (e) {
      return false;
    }
  },
}));
