import { useState, useRef, useEffect, useMemo } from "react";
import { useGraphStore } from "../../store/graphStore";
import { MULTI_PATH_STYLES, MULTI_PATH_COMMON_COLOR } from "./GraphCanvas";
import { Copy, Check } from "lucide-react";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Convertit une couleur hexadécimale en `rgba(...)` avec une opacité
 *  donnée — même utilitaire que dans GraphCanvas.tsx (dupliqué ici plutôt
 *  qu'importé pour ne pas élargir la surface d'export de GraphCanvas juste
 *  pour une fonction pure sans état). */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full  = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Empty / Loading ───────────────────────────────────────────────────────────
function EmptyState({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      <div className={cx(
        "w-14 h-14 rounded-2xl flex items-center justify-center",
        "bg-white dark:bg-slate-900 shadow-lg border border-slate-100 dark:border-slate-800",
        isRunning && "ring-4 ring-indigo-500/10"
      )}>
        {isRunning ? (
          <svg className="w-6 h-6 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
            <path d="M12 3a9 9 0 019 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-300" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-600">
          {isRunning ? "Calcul en cours…" : "Prêt à calculer"}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
          {isRunning ? "Exécution de l'algorithme de Dantzig" : "Appuyez sur  pour lancer l'algorithme"}
        </p>
      </div>
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AlgoStep {
  iteration: number;
  description: string;
  explanation?: string;
  currentNode?: string;
  lambdas: Record<string, number>;
  markedNodes: string[];
  selectedEdge?: { from: string; to: string; weight: number };
  // Champ injecté pour les étapes de révélation du chemin optimal
  pathRevealCount?: number;
}
interface OptimalPathEntry {
  from: string;
  to: string;
  path: string[];
}
interface AlgoResult {
  steps: AlgoStep[];
  optimalPaths: OptimalPathEntry[];
  // NOUVEAU : tous les chemins optimaux distincts (égalités de poids) vers
  // le sommet cible — peut contenir plusieurs entrées.
  optimalPathsToTarget?: OptimalPathEntry[];
  optimalPath?: OptimalPathEntry;
  sourceNode: string;
  targetNode: string;
  optimalValue: number;
}
interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

const fmt = (v: number) => (v === Infinity || v === -Infinity ? "∞" : String(v));

// ─── Reconstruction fidèle de l'algorithme de Dantzig ──────────────────────────
//
// Principe (vérifié contre le support de cours "Exercice 1 : DANTZIG") :
// - Chaque nœud déjà marqué garde "en attente" UNE seule arête candidate à la
//   fois : la moins chère parmi ses arêtes sortantes vers un nœud NON marqué,
//   pas encore révélée.
// - À chaque tour k, la liste affichée = toutes les candidates actuellement en
//   attente (anciennes non résolues + nouvelles révélées par le nœud qui vient
//   d'être marqué).
// - Le tour se résout par la valeur minimale parmi ces candidates : c'est elle
//   qui doit apparaître en rouge, et son nœud cible devient le nouveau marqué.
// - Le nœud-source dont la candidate vient de "gagner" (ou tout autre nœud dont
//   la candidate visait ce même nœud) révèle alors sa prochaine arête la moins
//   chère, pour le tour suivant.
//
// On garde l'ORDRE DE MARQUAGE produit par le backend (qui fait foi, y compris
// pour les départages d'égalité) ; on ne fait que reconstruire, pour chaque
// tour, QUI étaient les candidates en lice et laquelle a réellement gagné.

interface FrontierRow {
  from: string;
  to: string;
  weight: number;
  value: number;
}

interface DantzigRound {
  k: number;
  rows: FrontierRow[];
  winner: FrontierRow | null;
  newNode: string;
  markedSetAfter: string[];
}

function buildDantzigRounds(steps: AlgoStep[], edges: GraphEdge[]): DantzigRound[] {
  if (!steps.length) return [];

  // Étapes "Dantzig" pures (on exclut les étapes synthétiques de révélation du chemin)
  const dantzigSteps = steps.filter((s) => s.pathRevealCount === undefined);
  if (dantzigSteps.length < 2) return [];

  // Ordre réel de marquage, déduit de la croissance de markedNodes au fil des étapes.
  // C'est la source de vérité (gère aussi les égalités, déjà départagées par le backend).
  const order: string[] = [];
  const seen = new Set<string>();
  for (const s of dantzigSteps) {
    for (const n of s.markedNodes ?? []) {
      if (!seen.has(n)) {
        order.push(n);
        seen.add(n);
      }
    }
  }
  if (order.length < 2) return [];

  // Garde-fou : cette reconstruction suppose un marquage strictement croissant
  // (cas "min", à la Dijkstra/Dantzig). Si jamais ce n'est pas le cas (mode
  // "max" basé sur un DFS avec retour-arrière), on abandonne proprement.
  let monotonic = true;
  let prevLen = 0;
  for (const s of dantzigSteps) {
    const len = (s.markedNodes ?? []).length;
    if (len < prevLen) { monotonic = false; break; }
    prevLen = len;
  }
  if (!monotonic) return [];

  // Adjacence triée par poids croissant (= l'ordre dans lequel chaque nœud
  // révèle ses arêtes au fil des tours).
  const adjacency: Record<string, { to: string; weight: number }[]> = {};
  edges.forEach((e) => {
    if (!adjacency[e.from]) adjacency[e.from] = [];
    adjacency[e.from].push({ to: e.to, weight: e.weight });
  });
  Object.values(adjacency).forEach((list) => list.sort((a, b) => a.weight - b.weight));

  const marked = new Set<string>([order[0]]);
  const lambda: Record<string, number> = { [order[0]]: 0 };
  const pointer: Record<string, number> = {};
  const frontier: Record<string, FrontierRow | null> = {};

  function revealNext(src: string) {
    const list = adjacency[src] ?? [];
    let idx = pointer[src] ?? 0;
    while (idx < list.length && marked.has(list[idx].to)) idx++;
    if (idx < list.length) {
      const edge = list[idx];
      frontier[src] = { from: src, to: edge.to, weight: edge.weight, value: lambda[src] + edge.weight };
      pointer[src] = idx + 1;
    } else {
      frontier[src] = null;
      pointer[src] = idx;
    }
  }

  revealNext(order[0]);

  const rounds: DantzigRound[] = [];

  for (let k = 1; k < order.length; k++) {
    const nextNode = order[k];

    const rows = Object.keys(frontier)
      .filter((src) => frontier[src] && !marked.has(frontier[src]!.to))
      .map((src) => frontier[src]!)
      // ordre stable et lisible : par ordre de marquage du nœud source
      .sort((a, b) => order.indexOf(a.from) - order.indexOf(b.from));

    let winner = rows.find((r) => r.to === nextNode) ?? null;
    if (!winner && rows.length) {
      // Filet de sécurité si jamais une incohérence de données apparaît :
      // on prend la valeur minimale plutôt que de ne rien afficher.
      winner = rows.reduce((min, r) => (r.value < min.value ? r : min), rows[0]);
    }

    marked.add(nextNode);
    lambda[nextNode] = winner ? winner.value : lambda[nextNode] ?? 0;

    rounds.push({
      k,
      rows,
      winner,
      newNode: nextNode,
      markedSetAfter: order.slice(0, k + 1),
    });

    // Toute candidate (d'une source quelconque) qui visait nextNode devient
    // obsolète : la source correspondante révèle sa prochaine arête la moins chère.
    Object.keys(frontier).forEach((src) => {
      if (frontier[src] && frontier[src]!.to === nextNode) {
        revealNext(src);
      }
    });
    // Le nœud qui vient d'être marqué révèle lui-même sa première arête.
    revealNext(nextNode);
  }

  return rounds;
}

// ─── Appartenance des nœuds / arcs aux chemins optimaux multiples ──────────────
//
// Croise TOUS les chemins optimaux affichés (allTargetPaths) pour déterminer,
// pour chaque nœud et chaque arc, la liste des index de chemins qui le
// traversent. C'est l'équivalent, côté StepsPanel, de `nodePathIndices` dans
// GraphCanvas.tsx — mais calculé directement à partir des listes de nœuds des
// chemins plutôt que des arcs du graphe, puisque c'est tout ce dont on
// dispose ici.
//
// Règle (symétrique à celle du canvas) :
//   - appartient à 2+ chemins  → tronc commun → une seule couleur (bleu, voir
//     MULTI_PATH_COMMON_COLOR), jamais un mélange ni la couleur d'un chemin
//     individuel ;
//   - appartient à 1 seul chemin → coloré dans la couleur propre de ce
//     chemin (MULTI_PATH_STYLES).
interface PathMembership {
  nodeMembership: Map<string, number[]>;
  edgeMembership: Map<string, number[]>;
}

function computePathMembership(paths: OptimalPathEntry[]): PathMembership {
  const nodeMembership = new Map<string, number[]>();
  const edgeMembership = new Map<string, number[]>();

  paths.forEach((p, pi) => {
    p.path.forEach((node, ni) => {
      const nodeArr = nodeMembership.get(node) ?? [];
      if (!nodeArr.includes(pi)) nodeArr.push(pi);
      nodeMembership.set(node, nodeArr);

      if (ni < p.path.length - 1) {
        const key = `${node}->${p.path[ni + 1]}`;
        const edgeArr = edgeMembership.get(key) ?? [];
        if (!edgeArr.includes(pi)) edgeArr.push(pi);
        edgeMembership.set(key, edgeArr);
      }
    });
  });

  return { nodeMembership, edgeMembership };
}

// ─── Ensemble E_k ──────────────────────────────────────────────────────────────
function ESet({ index, nodes, pivot }: { index: number; nodes: string[]; pivot: string }) {
  return (
    <span className="font-mono text-[11px] text-slate-600">
      E<sub>{index}</sub> ={" { "}
      {nodes.map((id, i) => (
        <span key={id}>
          {i > 0 && <span className="text-slate-400">, </span>}
          <span className={cx("font-bold", id === pivot ? "text-amber-600" : "text-slate-600")}>
            {id}
          </span>
        </span>
      ))}
      {" }"}
    </span>
  );
}

// ─── Chemin (chips + flèches) ───────────────────────────────────────────────────
//
// Chaque chip de nœud reçoit désormais un fond teinté (comme les sommets en
// mode "chemin multiple" du canvas), pas seulement un contour coloré :
//   - nœuds de départ/arrivée : style ambre inchangé (rôle "point de repère",
//     indépendant de l'appartenance à un chemin) ;
//   - nœuds appartenant à UN SEUL chemin : fond + contour dans la couleur
//     propre de ce chemin ;
//   - nœuds appartenant à 2+ chemins (tronc commun) : fond + contour dans
//     l'unique couleur du commun (MULTI_PATH_COMMON_COLOR), jamais mélangés
//     avec une couleur de chemin individuel. Même règle pour les flèches
//     entre deux nœuds : l'arc qui les relie suit la couleur du tronc commun
//     dès qu'il est partagé par 2+ chemins.
function PathChips({
  path, color, pathIndex, nodeMembership, edgeMembership, small = false,
}: {
  path: string[];
  color: string;
  pathIndex: number;
  nodeMembership: Map<string, number[]>;
  edgeMembership: Map<string, number[]>;
  small?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {path.map((node, ni, arr) => {
        const isEndpoint = ni === 0 || ni === arr.length - 1;
        const memberships = nodeMembership.get(node) ?? [];
        const isCommon = !isEndpoint && memberships.length > 1;
        const nodeColor = isCommon ? MULTI_PATH_COMMON_COLOR : color;

        let edgeIsCommon = false;
        if (ni < arr.length - 1) {
          const key = `${node}->${arr[ni + 1]}`;
          edgeIsCommon = (edgeMembership.get(key) ?? []).length > 1;
        }
        const edgeColor = edgeIsCommon ? MULTI_PATH_COMMON_COLOR : color;

        return (
          <span key={ni} className="flex items-center gap-1">
            <span
              title={
                isEndpoint
                  ? undefined
                  : isCommon
                  ? "Nœud du tronc commun (partagé par plusieurs chemins optimaux)"
                  : `Nœud du Chemin ${pathIndex + 1}`
              }
              className={cx(
                "rounded-full border-2 flex items-center justify-center font-mono font-bold transition-colors duration-150",
                small ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-sm"
              )}
              style={{
                borderColor: isEndpoint ? "#f59e0b" : nodeColor,
                color: isEndpoint ? "#475569" : nodeColor,
                background: isEndpoint ? "#fde68a55" : hexToRgba(nodeColor, 0.14),
              }}
            >
              {node}
            </span>
            {ni < arr.length - 1 && (
              <span
                style={{ color: edgeColor }}
                className="font-bold text-xs transition-colors duration-150"
              >
                →
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function StepsPanel() {
  const {
    isComputed, isRunning, result, currentStepIndex, edges,
    pathDisplayMode, setPathDisplayMode,
    // Chemin actuellement survolé (pour l'isolement visuel sur le canvas) et
    // son setter. Séparé de `pathDisplayMode` : le survol est un effet
    // purement transitoire côté GraphCanvas, il ne modifie jamais la
    // sélection d'affichage persistante ni aucun autre état du store.
    hoveredPathIndex, setHoveredPathIndex,
  } = useGraphStore();
  const [showPaths, setShowPaths] = useState(false);
  /** Index du chemin dont le texte vient d'être copié (pour l'icône "✓" temporaire). */
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [currentStepIndex]);

  // Efface l'indicateur "copié" après un court délai
  useEffect(() => {
    if (copiedIndex === null) return;
    const t = setTimeout(() => setCopiedIndex(null), 1400);
    return () => clearTimeout(t);
  }, [copiedIndex]);

  // Filet de sécurité : si le composant est démonté pendant qu'un survol est
  // actif (ex. navigation ailleurs dans l'appli), on s'assure que l'état de
  // survol du store ne reste jamais "collé" à un index obsolète — sinon le
  // canvas resterait en permanence estompé pour un chemin qu'on ne survole
  // plus réellement.
  useEffect(() => {
    return () => setHoveredPathIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Données dérivées du résultat ────────────────────────────────────────────
  // Calculées AVANT tout retour anticipé (EmptyState) : les Hooks (useMemo
  // inclus) doivent être appelés dans le même ordre à chaque rendu, jamais
  // conditionnellement. `result` peut être `null` tant que le calcul n'a pas
  // été lancé — tout ce qui suit gère ce cas avec des valeurs de repli sûres,
  // pour que `allTargetPaths` (et donc le useMemo) reste toujours calculable.
  const typedResult = result as unknown as AlgoResult | null;
  const allTargetPaths: OptimalPathEntry[] = typedResult
    ? (typedResult.optimalPathsToTarget ?? (typedResult.optimalPath ? [typedResult.optimalPath] : []))
    : [];

  // Appartenance nœud/arc → chemin(s), pour la coloration du tronc commun.
  // Recalculée seulement quand la liste des chemins change réellement.
  const { nodeMembership, edgeMembership } = useMemo(
    () => computePathMembership(allTargetPaths),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(allTargetPaths.map((p) => p.path))]
  );

  if (!isComputed || !result || !typedResult) return <EmptyState isRunning={isRunning} />;

  const { steps, sourceNode, optimalValue } = typedResult;
  const totalSteps = steps.length;
  const progress = totalSteps > 1 ? currentStepIndex / (totalSteps - 1) : 1;

  const currentStep = steps[currentStepIndex] as AlgoStep;
  const isPathRevealStep = currentStep?.pathRevealCount !== undefined;
  const isFinal = currentStepIndex === totalSteps - 1;
  // Le résumé chemin complet n'apparaît qu'à la toute dernière étape
  const showPathResult = isFinal && isPathRevealStep;

  const initStep = steps[0];
  const allRounds = buildDantzigRounds(steps, (edges as GraphEdge[]) ?? []);

  // currentStepIndex = 0 → init (E1 seul, aucun tour k résolu)
  // currentStepIndex = 1 → le nœud source vient d'être marqué (toujours E1, pas de k)
  // currentStepIndex = i (i ≥ 2) → (i-1) tours k résolus
  const dantzigVisible = isPathRevealStep
    ? allRounds.length
    : Math.max(0, Math.min(currentStepIndex - 1, allRounds.length));
  const visibleRounds = allRounds.slice(0, dantzigVisible);

  // ── Chemins optimaux (multiples) ──────────────────────────────────────────
  const hasMultiplePaths = allTargetPaths.length > 1;
  const colorFor = (i: number) => MULTI_PATH_STYLES[i % MULTI_PATH_STYLES.length].stroke;

  // Indices actuellement mis en avant dans le canvas (pour synchroniser la
  // mise en évidence ici avec la sélection faite dans GraphPage / le canvas).
  const selectedIndices: number[] =
    pathDisplayMode === "all"
      ? allTargetPaths.map((_, i) => i)
      : [typeof pathDisplayMode === "number" ? pathDisplayMode : 0];

  const copyPath = (p: OptimalPathEntry, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(p.path.join(" → ")).then(() => setCopiedIndex(index));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Progress header ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2.5 backdrop-blur">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Trace d'exécution
          </span>
          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
            {currentStepIndex + 1} / {totalSteps}
          </span>
        </div>
        <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* ── Scrollable trace ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-0">

        {/* ─ Init ─ */}
        <div className="py-1.5 font-mono">
          <div className="flex items-baseline gap-1 text-[13px]">
            <span className="text-amber-600 font-bold">
              λ<sub className="text-[10px]">{sourceNode}</sub>
            </span>
            <span className="text-slate-600"> = {fmt(initStep.lambdas[sourceNode])}</span>
          </div>
          <div className="mt-0.5">
            <ESet index={1} nodes={[sourceNode]} pivot={sourceNode} />
          </div>
        </div>

        <div className="h-px bg-slate-100 dark:bg-slate-800/60 my-2" />

        {/* ─ Tours de l'algorithme de Dantzig ─ */}
        {visibleRounds.map((round, idx) => {
          // Un tour n'est "actif" (rouge sur le gagnant) que tant qu'on est sur
          // l'étape qui vient de le résoudre — exactement comme dans le support
          // de cours, où la ligne gagnante repasse en noir dès que E_{k+1} apparaît.
          const isActive = !isPathRevealStep && idx === visibleRounds.length - 1 && !isFinal;

          return (
            <div
              key={round.k}
              className={cx("py-2", idx > 0 && "border-t border-slate-100 dark:border-slate-800/40")}
            >
              <span className={cx(
                "font-mono font-bold text-[13px] underline underline-offset-2 decoration-1",
                isActive ? "text-indigo-600" : "text-slate-700"
              )}>
                k = {round.k}
              </span>

              <div className="mt-1 space-y-1 pl-1 font-mono">
                {round.rows.length > 0 ? (
                  round.rows.map((row, ri) => {
                    const isWinner =
                      isActive &&
                      !!round.winner &&
                      row.from === round.winner.from &&
                      row.to === round.winner.to;

                    return (
                      <div key={ri} className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-slate-600 text-[12px] whitespace-nowrap">
                          v({row.from},{row.to})
                        </span>
                        <span className={cx(
                          "text-[12px] whitespace-nowrap",
                          isWinner
                            ? "text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/30 px-1 rounded"
                            : "text-slate-400"
                        )}>
                          λ<sub className="text-[9px]">{row.to}</sub>
                          {" = "}λ<sub className="text-[9px]">{row.from}</sub>
                          {" + v("}
                          {row.from},{row.to}
                          {") = "}
                          <span>{fmt(row.value)}</span>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-400 text-[11px] italic">—</div>
                )}

                <div className="mt-0.5">
                  <ESet index={round.k + 1} nodes={round.markedSetAfter} pivot={round.newNode} />
                </div>
              </div>
            </div>
          );
        })}

        {/* ─ Résultat final (uniquement à la toute dernière étape) ─ */}
        {showPathResult && optimalValue !== undefined && (
          <div className="mt-4 pt-4 border-t-2 border-indigo-200 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                {hasMultiplePaths ? "Chemins de valeur optimale" : "Chemin de valeur optimale"}
              </p>
              {hasMultiplePaths && (
                <span className="text-[10px] font-mono text-slate-400">
                  {allTargetPaths.length} chemins à égalité
                </span>
              )}
            </div>

            {/* Légende du tronc commun — n'a de sens que s'il y a plusieurs
                chemins, donc potentiellement des segments partagés. */}
            {hasMultiplePaths && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: MULTI_PATH_COMMON_COLOR }}
                />
                <span>Tronc commun — segments partagés par plusieurs chemins</span>
              </div>
            )}

            {/* Indice d'usage du survol — n'apparaît qu'à partir de 5 chemins,
                seuil à partir duquel la lisibilité du canvas devient
                effectivement difficile (chevauchements, tronc commun dense). */}
            {allTargetPaths.length >= 5 && (
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400/80 italic">
                <span>Survolez un chemin ci-dessous pour l'isoler sur le graphe.</span>
              </div>
            )}

            {/* Un ou plusieurs chemins, chacun coloré comme dans le canvas
                (voir MULTI_PATH_STYLES), avec fonds teintés et tronc commun
                en bleu. Cliquer sur un chemin le sélectionne aussi dans le
                canvas (synchronisé avec le sélecteur GraphPage). Le survol
                d'une carte isole ce même chemin sur le canvas (voir
                `hoveredPathIndex` / GraphCanvas.tsx) sans changer la
                sélection persistante. */}
            <div className="space-y-2">
              {allTargetPaths.map((p, i) => {
                const isSelected = selectedIndices.includes(i);
                const isCopied = copiedIndex === i;
                const isHovered = hoveredPathIndex === i;
                return (
                  <button
                    key={i}
                    onClick={() => setPathDisplayMode(i)}
                    onMouseEnter={() => setHoveredPathIndex(i)}
                    onMouseLeave={() => setHoveredPathIndex(null)}
                    onFocus={() => setHoveredPathIndex(i)}
                    onBlur={() => setHoveredPathIndex(null)}
                    aria-pressed={isSelected}
                    className={cx(
                      "group w-full text-left rounded-lg border px-2.5 py-2 transition-all",
                      isSelected
                        ? "border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/20 dark:border-indigo-800/50"
                        : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30",
                      isHovered && "ring-2 ring-offset-1 ring-indigo-300/60 dark:ring-offset-slate-900"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      {hasMultiplePaths ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: colorFor(i) }}
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Chemin {i + 1}
                          </span>
                        </div>
                      ) : <span />}

                      {/* Copier le chemin — visible au survol / focus, ou en
                          permanence sur petit écran tactile (opacity-100
                          appliqué via group-hover ne cachant rien d'essentiel). */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => copyPath(p, i, e)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            copyPath(p, i, e as unknown as React.MouseEvent);
                          }
                        }}
                        title="Copier ce chemin"
                        aria-label="Copier ce chemin"
                        className={cx(
                          "p-1 rounded-md transition-all",
                          "opacity-0 group-hover:opacity-100 focus:opacity-100",
                          isCopied ? "text-emerald-500" : "text-slate-300 hover:text-indigo-500 hover:bg-white/70"
                        )}
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      </span>
                    </div>

                    <PathChips
                      path={p.path}
                      color={colorFor(i)}
                      pathIndex={i}
                      nodeMembership={nodeMembership}
                      edgeMembership={edgeMembership}
                    />

                    {/* Nœud de fin explicite — répond au retour "on voit pas
                        où celui-là finit exactement" : le dernier nœud du
                        chemin est répété en clair sous les chips, avec sa
                        propre couleur, pour lever toute ambiguïté même
                        quand le tronc commun rend le survol du chemin
                        complexe visuellement. */}
                    <div className="mt-1.5 text-[10px] font-mono text-slate-400">
                      <span>Arrivée : </span>
                      <span className="font-bold" style={{ color: colorFor(i) }}>
                        {p.path[p.path.length - 1]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMultiplePaths && (
              <button
                onClick={() => setPathDisplayMode(pathDisplayMode === "all" ? 0 : "all")}
                aria-pressed={pathDisplayMode === "all"}
                className={cx(
                  "text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors",
                  pathDisplayMode === "all"
                    ? "border-indigo-300 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-slate-200 text-slate-400 hover:text-indigo-500"
                )}
              >
                {pathDisplayMode === "all" ? "✓ Afficher tous les chemins" : "Afficher tous les chemins ensemble"}
              </button>
            )}

            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-500">Valeur optimale :</span>
              <span className="font-mono font-black text-indigo-600 text-base tabular-nums">
                {fmt(optimalValue)}
              </span>
            </div>

            {typedResult.optimalPaths.length > 1 && (
              <div>
                <button
                  onClick={() => setShowPaths((v) => !v)}
                  aria-expanded={showPaths}
                  className="text-[11px] text-slate-400 hover:text-indigo-500 transition-colors underline underline-offset-2"
                >
                  {showPaths ? "▲ Masquer" : `▼ Chemins vers tous les sommets (${typedResult.optimalPaths.length})`}
                </button>
                {showPaths && (
                  <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                    {typedResult.optimalPaths.map((p, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1 text-[11px] font-mono text-slate-500">
                        {p.path.map((n, ni) => (
                          <span key={ni} className="flex items-center gap-1">
                            <span className="font-bold text-slate-700">{n}</span>
                            {ni < p.path.length - 1 && <span className="text-slate-300">→</span>}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}