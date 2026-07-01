import { create } from "zustand";
import type { DantzigResult, DantzigStep, GraphNode, GraphEdge, ApiGraph } from "../types/graph";
import { graphService } from "../services/graphService";
import { INITIAL_NODES, INITIAL_EDGES } from "../constants/graphConstants";

// Ajuster pour correspondre exactement au rayon visuel des nœuds dans GraphCanvas.tsx
const NODE_RADIUS = 28;
// Espace réservé pour l'étiquette de poids affichée sur chaque arête
const EDGE_LABEL_WIDTH = 66;
const EDGE_LABEL_HEIGHT = 50;
// Évite les magic numbers dispersés dans arrangeGraph
const ARRANGE_MARGIN_X = 90;
const ARRANGE_MARGIN_Y = 90;
const ARRANGE_MAX_SCALE = 1.25;

/**
 * Cible de step à restaurer après un recalcul automatique déclenché par une
 * modification du graphe pendant qu'un résultat est déjà affiché :
 *  - un nombre  → on essaie de rester exactement sur ce step (clampé si le
 *    nouveau nombre total d'étapes est plus petit).
 *  - "end"      → on était sur la toute dernière étape au moment du
 *    changement ; on se replace donc sur la nouvelle dernière étape, quel
 *    que soit le nombre total d'étapes désormais.
 *  - undefined  → calcul "normal" (bouton Lancer) : on repart du début.
 */
type StepTarget = number | "end" | undefined;

/**
 * Sélection du/des chemin(s) optimal(aux) à mettre en évidence :
 *  - un nombre  → index (0-based) dans `result.optimalPathsToTarget`, un
 *    seul chemin affiché (en bleu, comportement historique).
 *  - "all"      → tous les chemins optimaux distincts sont affichés
 *    simultanément (voir MULTI_PATH_STYLES dans GraphCanvas.tsx).
 */
type PathDisplayMode = number | "all";

interface OptimalPathEntry {
  from: string;
  to: string;
  path: string[];
}

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
   * (e.g. inline editing of the weight badge). Implemented as a wrapper
   * around `updateEdge`, so it inherits the same "recalcul auto" behaviour.
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

  /**
   * `stepTarget` undefined = comportement normal, on repart du step 0.
   * Sert uniquement aux appels internes déclenchés par `maybeRecompute`.
   */
  executeDantzig: (stepTarget?: StepTarget) => Promise<void>;
  /**
   * Déclenché automatiquement par toute modification structurelle du
   * graphe (ajout/suppression de nœud, ajout/suppression d'arc, changement
   * de poids) lorsqu'un résultat est déjà affiché. Relance Dantzig en
   * arrière-plan SANS rien changer à l'affichage courant tant que le
   * nouveau résultat n'est pas prêt (isComputed/result restent ceux
   * d'avant), puis se replace sur le step où on était (ou sur la fin si on
   * y était), donnant l'illusion que seule "la suite" a changé.
   */
  maybeRecompute: () => void;
  resetResult: () => void;

  setCurrentStepIndex: (index: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToFirstStep: () => void;
  goToLastStep: () => void;

  error: string | null;
  clearError: () => void;

  // ── Chemins optimaux multiples ─────────────────────────────────────────
  /**
   * Chemin(s) actuellement sélectionné(s) pour l'affichage. Réinitialisé à
   * 0 sur un calcul "normal" (bouton Lancer) ; clampé/préservé sur un
   * recalcul en arrière-plan (`maybeRecompute`).
   */
  pathDisplayMode: PathDisplayMode;
  setPathDisplayMode: (mode: PathDisplayMode) => void;
  /** Liste brute de tous les chemins optimaux distincts vers la cible. */
  getOptimalPathsList: () => OptimalPathEntry[];
  /**
   * Chemin(s) réellement à dessiner compte tenu de `pathDisplayMode`
   * (un seul élément en mode "index", tous en mode "all").
   */
  getActivePaths: () => OptimalPathEntry[];
  /**
   * Pour un arc donné, indices (dans la liste COMPLÈTE, pas la liste
   * filtrée) des chemins optimaux qui l'empruntent — utilisé uniquement en
   * mode "all" par GraphCanvas pour dessiner un tracé par chemin avec sa
   * propre couleur. Retourne toujours [] hors mode "all".
   */
  getPathIndicesForEdge: (from: string, to: string) => number[];

  getCurrentStep: () => DantzigStep | null;
  getNodeLambda: (nodeId: string) => number | null;
  isNodeMarked: (nodeId: string) => boolean;
  isCurrentNode: (nodeId: string) => boolean;
  isSelectedEdge: (from: string, to: string) => boolean;
  isNodeInOptimalPath: (nodeId: string) => boolean;
  isEdgeInOptimalPath: (from: string, to: string) => boolean;

  // FIX : l'implémentation ne fait jamais "await" sur l'import dynamique de
  // d3-force, donc elle retourne immédiatement et de façon synchrone. La
  // déclarer comme `Promise<void>` ici alors qu'elle renvoie `void` à
  // l'exécution provoquait une erreur de type TypeScript qui pouvait
  // bloquer la compilation/le hot-reload silencieusement.
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

  // ── Modifications structurelles ────────────────────────────────────────
  // Chacune applique le changement de données puis délègue à
  // `maybeRecompute`, qui décide s'il faut relancer Dantzig en tâche de
  // fond (seulement si un résultat était déjà affiché).
  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
    get().maybeRecompute();
  },

  addEdge: (edge) => {
    set((state) => ({ edges: [...state.edges, edge] }));
    get().maybeRecompute();
  },

  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  // Changer le poids (ou tout autre champ) d'un arc invalide l'ancien
  // résultat Dantzig → recalcul auto en arrière-plan.
  updateEdge: (id, updates) => {
    set((state) => ({
      edges: state.edges.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
    get().maybeRecompute();
  },

  // Fix: GraphCanvas's inline weight editor calls `updateEdgeWeight`, which
  // never existed before — edits to an edge's weight were silently dropped.
  // Implemented as a thin wrapper around `updateEdge` so both stay
  // consistent, including the auto-recompute behaviour.
  updateEdgeWeight: (id, weight) => get().updateEdge(id, { weight }),

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.from !== id && e.to !== id),
    }));
    get().maybeRecompute();
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    }));
    get().maybeRecompute();
  },

  // Déplacement de nœud = purement visuel, n'affecte pas l'algorithme :
  // pas de recalcul ici.
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

  // ── Chemins optimaux multiples ─────────────────────────────────────────
  pathDisplayMode: 0,
  setPathDisplayMode: (mode) => set({ pathDisplayMode: mode }),

  getOptimalPathsList: () => {
    const r = get().result as any;
    if (!r) return [];
    return (r.optimalPathsToTarget as OptimalPathEntry[] | undefined)
      ?? (r.optimalPath ? [r.optimalPath as OptimalPathEntry] : []);
  },

  getActivePaths: () => {
    const { pathDisplayMode } = get();
    const all = get().getOptimalPathsList();
    if (!all.length) return [];
    if (pathDisplayMode === "all") return all;
    const idx = typeof pathDisplayMode === "number" ? pathDisplayMode : 0;
    return all[idx] ? [all[idx]] : [all[0]];
  },

  getPathIndicesForEdge: (from, to) => {
    const { result, currentStepIndex, pathDisplayMode } = get();
    if (pathDisplayMode !== "all") return [];
    const r = result as any;
    if (!r?.optimalPath?.path) return [];
    const step = (r.steps as any[])[currentStepIndex];
    if (step?.pathRevealCount === undefined) return [];

    const all = get().getOptimalPathsList();
    const indices: number[] = [];
    all.forEach((p, i) => {
      const path = p.path;
      const startIdx = path.length - 1 - step.pathRevealCount;
      for (let k = Math.max(0, startIdx); k < path.length - 1; k++) {
        if (path[k] === from && path[k + 1] === to) {
          indices.push(i);
          break;
        }
      }
    });
    return indices;
  },

  maybeRecompute: () => {
    const { isComputed, currentStepIndex, totalSteps } = get();
    // Rien n'était affiché → rien à "faire semblant" de préserver, on ne
    // lance pas de calcul tout seul (l'utilisateur appuiera sur "Lancer").
    if (!isComputed) return;
    const wasAtEnd = totalSteps > 0 && currentStepIndex === totalSteps - 1;
    get().executeDantzig(wasAtEnd ? "end" : currentStepIndex);
  },

  executeDantzig: async (stepTarget) => {
    const { nodes, edges, sourceNode, optimizationType, pathDisplayMode } = get();

    // Important : on NE touche PAS à `isComputed`/`result` ici. Tant que le
    // nouveau résultat n'est pas prêt, l'ancien reste affiché tel quel —
    // c'est ce qui donne l'illusion que "rien n'a changé avant" pendant que
    // le recalcul tourne en réalité en arrière-plan.
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

      // ── Injection des étapes de révélation du/des chemin(s) optimal(aux) ──
      // On ajoute des étapes synthétiques APRÈS les étapes Dantzig normales.
      // Chaque étape révèle un arc supplémentaire de plus, en remontant du
      // nœud final vers la source. `pathRevealCount` est commun à TOUS les
      // chemins optimaux (au cas où ils auraient des longueurs différentes,
      // on se cale sur le plus long pour que chacun ait le temps de se
      // révéler entièrement) ; côté lecture, chaque chemin se contente de
      // clamper ce compteur à sa propre longueur (voir isEdgeInOptimalPath).
      const allTargetPaths: OptimalPathEntry[] =
        (result as any).optimalPathsToTarget
        ?? (result.optimalPath ? [result.optimalPath as unknown as OptimalPathEntry] : []);

      if (allTargetPaths.length && allTargetPaths.some((p) => p.path.length >= 2)) {
        const maxLen = Math.max(...allTargetPaths.map((p) => p.path.length));
        const lastStep = result.steps[result.steps.length - 1];

        for (let revealed = 1; revealed <= maxLen - 1; revealed++) {
          (result.steps as any[]).push({
            iteration: result.steps.length,
            description: `Remontée du chemin optimal (${revealed}/${maxLen - 1})`,
            currentNode: undefined,
            lambdas: { ...lastStep.lambdas },
            markedNodes: [...lastStep.markedNodes],
            // Nombre d'arcs révélés depuis la fin (1, 2, …, maxLen-1)
            pathRevealCount: revealed,
          });
        }
      }

      const newTotal = result.steps.length;

      // Détermine l'étape sur laquelle se replacer :
      //  - "end"      → nouvelle dernière étape (on y était au changement)
      //  - un nombre  → on essaie de rester pile sur ce step, clampé si le
      //                 nouveau total d'étapes est plus petit
      //  - undefined  → calcul "normal" (bouton Lancer) : on repart de 0
      const nextIndex =
        stepTarget === "end"
          ? Math.max(0, newTotal - 1)
          : typeof stepTarget === "number"
          ? Math.min(stepTarget, Math.max(0, newTotal - 1))
          : 0;

      // Sélection du chemin affiché :
      //  - calcul "normal" (stepTarget undefined)      → on repart sur le
      //    premier chemin optimal (comportement historique, en bleu).
      //  - recalcul en arrière-plan (maybeRecompute)    → on essaie de
      //    conserver le choix précédent ("all" reste "all" ; un index est
      //    clampé si le nouveau graphe a moins de chemins optimaux).
      const nextPathDisplayMode: PathDisplayMode =
        stepTarget === undefined
          ? 0
          : pathDisplayMode === "all"
          ? "all"
          : typeof pathDisplayMode === "number" && pathDisplayMode < allTargetPaths.length
          ? pathDisplayMode
          : 0;

      set({
        isRunning: false,
        isComputed: true,
        result,
        currentStepIndex: nextIndex,
        totalSteps: newTotal,
        pathDisplayMode: nextPathDisplayMode,
      });
    } catch (error) {
      // Le recalcul a échoué (ex: source supprimée) : on laisse l'ancien
      // résultat affiché plutôt que de tout effacer, et on signale l'erreur.
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
    pathDisplayMode: 0,
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

  // Un nœud est "dans le chemin optimal" s'il appartient à au moins UN des
  // chemins actuellement actifs (un seul en mode index, plusieurs en mode
  // "all") — la distinction visuelle par chemin (couleurs multiples) est
  // gérée séparément par `getPathIndicesForEdge` côté GraphCanvas.
  isNodeInOptimalPath: (nodeId) => {
    const { result, currentStepIndex } = get();
    const r = result as any;
    if (!r?.optimalPath?.path) return false;

    const step = (r.steps as any[])[currentStepIndex];
    if (step?.pathRevealCount === undefined) return false;

    const paths = get().getActivePaths();
    return paths.some((p) => {
      const revealedNodes = p.path.slice(Math.max(0, p.path.length - step.pathRevealCount - 1));
      return revealedNodes.includes(nodeId);
    });
  },

  isEdgeInOptimalPath: (from, to) => {
    const { result, currentStepIndex } = get();
    const r = result as any;
    if (!r?.optimalPath?.path) return false;

    const step = (r.steps as any[])[currentStepIndex];
    if (step?.pathRevealCount === undefined) return false;

    const paths = get().getActivePaths();
    return paths.some((p) => {
      const path = p.path;
      const startIdx = path.length - 1 - step.pathRevealCount;
      for (let i = Math.max(0, startIdx); i < path.length - 1; i++) {
        if (path[i] === from && path[i + 1] === to) return true;
      }
      return false;
    });
  },

  arrangeGraph: () => {
    const { nodes, edges, sourceNode, canvasWidth, canvasHeight } = get();
    if (!nodes.length) return;

    if (nodes.length === 1) {
      set({ nodes: [{ ...nodes[0], x: canvasWidth / 2, y: canvasHeight / 2 }] });
      return;
    }

    import("d3-force")
      .then(({
        forceSimulation,
        forceLink,
        forceManyBody,
        forceCenter,
        forceCollide,
        forceX,
        forceY,
      }) => {
        const anchor = sourceNode ?? nodes[0].id;
        const realEdges = edges.filter(e => e.from !== e.to); // exclut les boucles

        // ── Adjacence dirigée (pour la détection de cycles + le rang) ──────
        const outAdj: Record<string, string[]> = {};
        nodes.forEach(n => { outAdj[n.id] = []; });
        realEdges.forEach(e => { outAdj[e.from]?.push(e.to); });

        // ── 1) Détection des arcs de retour (DFS itératif, pile explicite) ─
        // Un graphe d'algorithme de plus court chemin n'est pas forcément un
        // DAG (ex: deux arcs opposés A→B et B→A). Pour calculer un "rang"
        // cohérent gauche→droite, on identifie les arcs qui referment un
        // cycle (arc vers un nœud déjà présent dans la pile DFS courante) et
        // on les exclut temporairement du graphe utilisé pour le rang —
        // sans jamais toucher au sens réel des arêtes pour le rendu/flèches.
        const backEdges = new Set<string>(); // clé = "from→to"
        const visited = new Set<string>();
        const onStack = new Set<string>();

        const dfs = (start: string) => {
          const stack: { id: string; iter: number }[] = [{ id: start, iter: 0 }];
          visited.add(start);
          onStack.add(start);
          while (stack.length) {
            const top = stack[stack.length - 1];
            const neighbors = outAdj[top.id] ?? [];
            if (top.iter < neighbors.length) {
              const nb = neighbors[top.iter++];
              if (onStack.has(nb)) {
                backEdges.add(`${top.id}→${nb}`);
              } else if (!visited.has(nb)) {
                visited.add(nb);
                onStack.add(nb);
                stack.push({ id: nb, iter: 0 });
              }
            } else {
              onStack.delete(top.id);
              stack.pop();
            }
          }
        };
        dfs(anchor);
        nodes.forEach(n => { if (!visited.has(n.id)) dfs(n.id); });

        const forwardEdges = realEdges.filter(e => !backEdges.has(`${e.from}→${e.to}`));

        // ── 2) Composantes connexes isolées → reliées par arc fantôme ──────
        // Sur le graphe acyclique restant, on relie artificiellement la
        // racine de chaque composante qui n'est pas reliée à l'ancre, afin
        // que le rang cascade correctement et qu'il n'y ait jamais deux
        // composantes empilées au même rang 0 (= superposition).
        const undirected: Record<string, Set<string>> = {};
        nodes.forEach(n => { undirected[n.id] = new Set(); });
        realEdges.forEach(e => { undirected[e.from]?.add(e.to); undirected[e.to]?.add(e.from); });

        const compVisited = new Set<string>();
        const components: string[][] = [];
        nodes.forEach(n => {
          if (compVisited.has(n.id)) return;
          const comp: string[] = [];
          const queue = [n.id];
          compVisited.add(n.id);
          while (queue.length) {
            const cur = queue.shift()!;
            comp.push(cur);
            undirected[cur]?.forEach(nb => {
              if (!compVisited.has(nb)) { compVisited.add(nb); queue.push(nb); }
            });
          }
          components.push(comp);
        });

        const inDeg: Record<string, number> = {};
        forwardEdges.forEach(e => { inDeg[e.to] = (inDeg[e.to] ?? 0) + 1; });

        const ghostEdges: { from: string; to: string }[] = [];
        const anchorComp = components.find(c => c.includes(anchor)) ?? components[0];
        components.forEach(comp => {
          if (comp === anchorComp) return;
          const root = comp.find(id => !inDeg[id]) ?? comp[0];
          ghostEdges.push({ from: anchor, to: root });
        });
        const rankEdges = [...forwardEdges, ...ghostEdges];

        // ── 3) Rang = plus long chemin (topologique, via Kahn) ─────────────
        const rankAdj: Record<string, string[]> = {};
        nodes.forEach(n => { rankAdj[n.id] = []; });
        const rankInDeg: Record<string, number> = {};
        nodes.forEach(n => { rankInDeg[n.id] = 0; });
        rankEdges.forEach(e => { rankAdj[e.from]?.push(e.to); rankInDeg[e.to] = (rankInDeg[e.to] ?? 0) + 1; });

        const rank: Record<string, number> = {};
        nodes.forEach(n => { rank[n.id] = 0; });
        const queue = nodes.filter(n => rankInDeg[n.id] === 0).map(n => n.id);
        const inDegMut = { ...rankInDeg };
        while (queue.length) {
          const u = queue.shift()!;
          (rankAdj[u] ?? []).forEach(v => {
            rank[v] = Math.max(rank[v], rank[u] + 1);
            inDegMut[v]--;
            if (inDegMut[v] === 0) queue.push(v);
          });
        }
        const maxRank = Math.max(...Object.values(rank), 1);

        // ── 4) Tri barycentrique par rang (réduction des croisements) ──────
        const order: Record<string, number> = {};
        nodes.forEach((n, i) => { order[n.id] = i; });
        const byRank: string[][] = [];
        for (let r = 0; r <= maxRank; r++) byRank[r] = nodes.filter(n => rank[n.id] === r).map(n => n.id);

        const sweep = (forward: boolean) => {
          const range = forward
            ? byRank.map((_, i) => i).slice(1)
            : byRank.map((_, i) => i).slice(0, -1).reverse();
          range.forEach(r => {
            const ref = forward ? r - 1 : r + 1;
            byRank[r] = [...byRank[r]].sort((a, b) => {
              const nbA = undirected[a] ?? new Set<string>();
              const nbB = undirected[b] ?? new Set<string>();
              const avg = (nbs: Set<string>, id: string) => {
                const relevant = [...nbs].filter(nb => rank[nb] === ref);
                return relevant.length
                  ? relevant.reduce((s, nb) => s + order[nb], 0) / relevant.length
                  : order[id];
              };
              return avg(nbA, a) - avg(nbB, b);
            });
            byRank[r].forEach((id, i) => { order[id] = i; });
          });
        };
        for (let pass = 0; pass < 4; pass++) { sweep(true); sweep(false); }

        // ── 5) Placement initial : organique, avec un vrai aléa (pas de seed) ─
        // Volontairement non-seedé : à chaque clic sur "Arranger", la
        // disposition varie légèrement, tout en gardant la structure de
        // rang/ordre calculée ci-dessus.
        const usableW = canvasWidth - ARRANGE_MARGIN_X * 2;
        const usableH = canvasHeight - ARRANGE_MARGIN_Y * 2;

        const simNodes = nodes.map(n => {
          const r = rank[n.id];
          const levelIds = byRank[r] ?? [n.id];
          const idx = levelIds.indexOf(n.id);
          const total = levelIds.length || 1;

          const baseX = ARRANGE_MARGIN_X + (r / maxRank) * usableW;
          const baseY = ARRANGE_MARGIN_Y + ((idx + 0.5) / total) * usableH;

          return {
            id: n.id,
            x: baseX + (Math.random() - 0.5) * 36,
            y: baseY + (Math.random() - 0.5) * (usableH / Math.max(total, 3)) * 0.6,
          };
        });

        const simLinks: { source: string; target: string; dist: number }[] = [
          ...forwardEdges,
          ...realEdges.filter(e => backEdges.has(`${e.from}→${e.to}`)),
        ].map(e => ({
          source: e.from,
          target: e.to,
          // distance légèrement randomisée par arête → variation organique
          // d'un appel à l'autre, sans dégrader la structure.
          dist: 100 + Math.random() * 50,
        }));
        ghostEdges.forEach(e => simLinks.push({ source: e.from, target: e.to, dist: 100 }));

        const degree: Record<string, number> = {};
        nodes.forEach(n => { degree[n.id] = (outAdj[n.id]?.length ?? 0) + (undirected[n.id]?.size ?? 0); });
        const isGhost = new Set(ghostEdges.map(e => `${e.from}→${e.to}`));

        const simulation = forceSimulation(simNodes as any)
          .force("link", forceLink(simLinks as any)
            .id((d: any) => d.id)
            .distance((l: any) => l.dist)
            .strength((l: any) => isGhost.has(`${l.source.id ?? l.source}→${l.target.id ?? l.target}`) ? 0.02 : 0.55)
          )
          .force("charge", forceManyBody()
            .strength(() => -550 - Math.random() * 250)
            .distanceMax(550)
          )
          .force("center", forceCenter(canvasWidth / 2, canvasHeight / 2).strength(0.04))
          .force("collide", forceCollide((d: any) => 34 + (degree[d.id] ?? 0) * 3).strength(0.9).iterations(3))
          // Force X SOUPLE vers le rang : assez forte pour garder le flux
          // gauche→droite lisible, assez faible pour que les colonnes ne
          // soient jamais parfaitement alignées comme dans un layout "plat".
          .force("x", forceX((d: any) => ARRANGE_MARGIN_X + (rank[d.id] / maxRank) * usableW).strength(0.32))
          .force("y", forceY((d: any) => {
            const r = rank[d.id];
            const levelIds = byRank[r] ?? [d.id];
            const idx = levelIds.indexOf(d.id);
            const total = levelIds.length || 1;
            return ARRANGE_MARGIN_Y + ((idx + 0.5) / total) * usableH;
          }).strength(0.12))
          .alphaDecay(0.022)
          .velocityDecay(0.38)
          .stop();

        const iterations = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
        for (let i = 0; i < iterations; i++) simulation.tick();

        // ── 6) Recentrage / normalisation dans le canvas ───────────────────
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        simNodes.forEach((p: any) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
        const graphW = maxX - minX || 1;
        const graphH = maxY - minY || 1;
        const scale = Math.min(usableW / graphW, usableH / graphH, ARRANGE_MAX_SCALE);
        const offX = (canvasWidth - graphW * scale) / 2 - minX * scale;
        const offY = (canvasHeight - graphH * scale) / 2 - minY * scale;

        const newNodes = nodes.map(n => {
          const sim = simNodes.find((p: any) => p.id === n.id) as any;
          if (!sim) return n;
          return { ...n, x: sim.x * scale + offX, y: sim.y * scale + offY };
        });

        set({ nodes: newNodes });
      })
      .catch((err) => {
        // FIX : avant, une erreur ici (ex. d3-force absent du bundle, ou
        // exception dans le calcul) partait en "unhandled promise
        // rejection" — visible uniquement dans la console du navigateur,
        // jamais dans l'UI. On la stocke maintenant dans `error` pour
        // qu'elle s'affiche comme n'importe quelle autre erreur de l'appli.
        console.error("arrangeGraph a échoué :", err);
        set({
          error: err instanceof Error
            ? `Échec de la disposition automatique : ${err.message}`
            : "Échec de la disposition automatique",
        });
      });
  },
}));