import { useState, useRef, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
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
          {isRunning ? "Exécution de l'algorithme de Dantzig" : "Appuyez sur ▶ pour lancer l'algorithme"}
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
}
interface AlgoResult {
  steps: AlgoStep[];
  optimalPaths: { from: string; to: string; path: string[] }[];
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

function buildIterations(steps: AlgoStep[], edges: GraphEdge[]) {
  // Build adjacency list from graph edges for quick lookup
  const adjacency: Record<string, { to: string; weight: number }[]> = {};
  edges.forEach((e) => {
    if (!adjacency[e.from]) adjacency[e.from] = [];
    adjacency[e.from].push({ to: e.to, weight: e.weight });
  });

  return steps.slice(1).map((curr, i) => {
    const prev = steps[i];
    const pivot = curr.currentNode!;

    // All outgoing edges from pivot (from the graph)
    const outEdges = adjacency[pivot] ?? [];

    // Which ones actually improved a lambda?
    const improvedSet = new Set<string>();
    Object.keys(curr.lambdas).forEach((id) => {
      if (id !== pivot && curr.lambdas[id] !== prev.lambdas[id] && curr.lambdas[id] !== Infinity) {
        improvedSet.add(id);
      }
    });

    // Build full edge list: all arcs from pivot, flagged as winner or not
    const allEdgeLines = outEdges.map((e) => {
      const winner = improvedSet.has(e.to);
      const newLambda = curr.lambdas[e.to];
      return {
        to: e.to,
        weight: e.weight,
        fromNode: pivot,
        newLambda,
        winner,
      };
    });

    return {
      k: i + 1,
      pivot,
      lambdaAfter: curr.lambdas,
      markedSetAfter: curr.markedNodes,
      allEdgeLines,
    };
  });
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

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function StepsPanel() {
  const { isComputed, isRunning, result, currentStepIndex, edges } = useGraphStore();
  const [showPaths, setShowPaths] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [currentStepIndex]);

  if (!isComputed || !result) return <EmptyState isRunning={isRunning} />;

  const typedResult = result as AlgoResult;
  const { steps, sourceNode, optimalPaths, optimalValue } = typedResult;
  const totalSteps = steps.length;
  const progress = totalSteps > 1 ? currentStepIndex / (totalSteps - 1) : 1;

  const initStep = steps[0];
  const allIterations = buildIterations(steps, (edges as GraphEdge[]) ?? []);
  const visibleIterations = allIterations.slice(0, currentStepIndex);
  const isFinal = currentStepIndex === totalSteps - 1;

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

        {/* ─ Iterations ─ */}
        {visibleIterations.map((iter, idx) => {
          const isActive = idx === visibleIterations.length - 1 && !isFinal;

          return (
            <div
              key={iter.k}
              className={cx("py-2", idx > 0 && "border-t border-slate-100 dark:border-slate-800/40")}
            >
              {/* k = N */}
              <span className={cx(
                "font-mono font-bold text-[13px] underline underline-offset-2 decoration-1",
                isActive ? "text-indigo-600" : "text-slate-700"
              )}>
                k = {iter.k}
              </span>

              <div className="mt-1 space-y-1 pl-1 font-mono">
                {iter.allEdgeLines.length > 0 ? (
                  iter.allEdgeLines.map((edge, ei) => (
                    <div key={ei}>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {/* v(X,Y) — toujours en noir */}
                        <span className="text-slate-600 text-[12px] whitespace-nowrap">
                          v({edge.fromNode},{edge.to})
                        </span>

                        {/* formule λ — rouge si amélioré, gris sinon */}
                        <span className={cx(
                          "text-[12px] whitespace-nowrap",
                          edge.winner
                            ? "text-red-600 dark:text-red-400 font-semibold"
                            : "text-slate-400"
                        )}>
                          λ<sub className="text-[9px]">{edge.to}</sub>
                          {" = "}λ<sub className="text-[9px]">{edge.fromNode}</sub>
                          {" + v("}
                          {edge.fromNode},{edge.to}
                          {") = "}
                          <span className={edge.winner ? "font-bold" : ""}>
                            {fmt(edge.newLambda)}
                          </span>
                        </span>
                      </div>

                      {/* E_{k+1} sous la 1ère ligne seulement */}
                      {ei === 0 && (
                        <div className="mt-0.5">
                          <ESet
                            index={iter.k + 1}
                            nodes={iter.markedSetAfter}
                            pivot={iter.pivot}
                          />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-[11px] italic">
                    — <ESet index={iter.k + 1} nodes={iter.markedSetAfter} pivot={iter.pivot} />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ─ Résultat final ─ */}
        {isFinal && optimalValue !== undefined && (
          <div className="mt-4 pt-4 border-t-2 border-indigo-200 dark:border-indigo-800/60 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
              Chemin de valeur optimale
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              {optimalPaths[optimalPaths.length - 1]?.path.map((node, ni, arr) => (
                <span key={ni} className="flex items-center gap-1.5">
                  <span className={cx(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono font-bold text-sm",
                    ni === 0 || ni === arr.length - 1
                      ? "bg-amber-200 border-amber-300 text-slate-600 shadow-sm"
                      : "bg-white border-indigo-400 text-indigo-600"
                  )}>
                    {node}
                  </span>
                  {ni < arr.length - 1 && (
                    <span className="text-indigo-400 font-bold">→</span>
                  )}
                </span>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-500">Valeur optimale :</span>
              <span className="font-mono font-black text-indigo-600 text-base tabular-nums">
                {fmt(optimalValue)}
              </span>
            </div>

            {optimalPaths.length > 1 && (
              <div>
                <button
                  onClick={() => setShowPaths((v) => !v)}
                  className="text-[11px] text-slate-400 hover:text-indigo-500 transition-colors underline underline-offset-2"
                >
                  {showPaths ? "▲ Masquer" : `▼ Tous les chemins (${optimalPaths.length})`}
                </button>
                {showPaths && (
                  <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                    {optimalPaths.map((p, i) => (
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