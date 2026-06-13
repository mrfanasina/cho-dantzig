import { useState } from "react";
import { useGraphStore } from "../../store/graphStore";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Empty / Loading state ─────────────────────────────────────────────────────
function EmptyState({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <div
        className={cx(
          "w-14 h-14 rounded-2xl flex items-center justify-center",
          "bg-slate-100 dark:bg-slate-800/80",
          "border border-slate-200 dark:border-white/6"
        )}
      >
        {isRunning ? (
          <svg
            className="w-6 h-6 animate-spin text-indigo-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              strokeOpacity="0.25"
            />
            <path
              d="M12 3a9 9 0 019 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d="M12 7v5l3 2" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {isRunning ? "Calcul en cours…" : "Prêt à calculer"}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
          {isRunning
            ? "Exécution de l'algorithme de Dantzig"
            : "Appuyez sur ▶ pour lancer l'algorithme"}
        </p>
      </div>
    </div>
  );
}

// ─── Lambda grid ───────────────────────────────────────────────────────────────
function LambdaGrid({
  lambdas,
  markedNodes,
  currentNode,
}: {
  lambdas: Record<string, number>;
  markedNodes: string[];
  currentNode?: string;
}) {
  const formatVal = (v: number) => (v === Infinity ? "∞" : String(v));

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {Object.entries(lambdas).map(([nodeId, lambda]) => {
        const isMarked = markedNodes.includes(nodeId);
        const isCurrent = currentNode === nodeId;
        return (
          <div
            key={nodeId}
            className={cx(
              "flex items-center justify-between px-2.5 py-2 rounded-lg border text-[11px] font-mono transition-all duration-200",
              isCurrent
                ? "bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/30 ring-1 ring-indigo-500/25"
                : isMarked
                ? "bg-amber-500/6 dark:bg-amber-500/10 border-amber-500/20"
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/6"
            )}
          >
            <span
              className={cx(
                "font-bold",
                isCurrent
                  ? "text-indigo-600 dark:text-indigo-400"
                  : isMarked
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              λ<sub>{nodeId.toUpperCase()}</sub>
            </span>
            <span
              className={cx(
                "font-bold tabular-nums",
                isCurrent
                  ? "text-indigo-700 dark:text-indigo-300"
                  : isMarked
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-slate-600 dark:text-slate-300"
              )}
            >
              {formatVal(lambda)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Marked nodes chips ────────────────────────────────────────────────────────
function MarkedNodes({
  nodes,
  currentNode,
  stepIndex,
}: {
  nodes: string[];
  currentNode?: string;
  stepIndex: number;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
        Sommets marqués — E<sub>{stepIndex + 1}</sub>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {nodes.length === 0 ? (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">Aucun</span>
        ) : (
          nodes.map((id) => (
            <span
              key={id}
              className={cx(
                "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-200",
                currentNode === id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25"
              )}
            >
              {id.toUpperCase()}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Selected edge ─────────────────────────────────────────────────────────────
function SelectedEdge({
  edge,
}: {
  edge: { from: string; to: string; weight: number };
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/6 dark:bg-emerald-500/10 border border-emerald-500/20">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400">
          {edge.from.toUpperCase()} → {edge.to.toUpperCase()}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
          v = {edge.weight}
        </span>
      </div>
    </div>
  );
}

// ─── Optimal paths ─────────────────────────────────────────────────────────────
function OptimalPaths({
  paths,
}: {
  paths: { from: string; to: string; path: string[] }[];
}) {
  return (
    <div className="space-y-2">
      {paths.map((p, i) => (
        <div
          key={i}
          className={cx(
            "p-2.5 rounded-lg border text-[11px]",
            "bg-slate-50 dark:bg-slate-800/60",
            "border-slate-200 dark:border-white/6"
          )}
        >
          <div className="font-semibold font-mono text-slate-600 dark:text-slate-300 mb-1">
            {p.from.toUpperCase()} → {p.to.toUpperCase()}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {p.path.map((node, ni) => (
              <span key={ni} className="flex items-center gap-1">
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {node.toUpperCase()}
                </span>
                {ni < p.path.length - 1 && (
                  <span className="text-slate-300 dark:text-slate-600">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function StepsPanel() {
  const { isComputed, isRunning, result, currentStepIndex } = useGraphStore();
  const [showPaths, setShowPaths] = useState(false);

  if (!isComputed || !result) {
    return <EmptyState isRunning={isRunning} />;
  }

  const step = result.steps[currentStepIndex];
  const totalSteps = result.steps.length;
  const progress = totalSteps > 1 ? currentStepIndex / (totalSteps - 1) : 1;

  return (
    <div className="flex flex-col gap-0 h-full">

      {/* ── Carte de l'étape courante ── */}
      <div className="p-3 border-b border-slate-200 dark:border-white/5">

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0">
            {currentStepIndex + 1}/{totalSteps}
          </span>
          <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Description */}
        <div
          className={cx(
            "rounded-xl border p-3",
            "bg-indigo-500/6 dark:bg-indigo-500/10",
            "border-indigo-500/20 dark:border-indigo-500/20"
          )}
        >
          <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">
            Étape {currentStepIndex + 1}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug mb-1.5">
            {step.description}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {step.explanation}
          </p>
        </div>
      </div>

      {/* ── Valeurs des λ ── */}
      <div className="p-3 border-b border-slate-200 dark:border-white/5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          Valeurs des λ
        </p>
        <LambdaGrid
          lambdas={step.lambdas}
          markedNodes={step.markedNodes}
          currentNode={step.currentNode}
        />
      </div>

      {/* ── Sommets marqués ── */}
      <div className="p-3 border-b border-slate-200 dark:border-white/5">
        <MarkedNodes
          nodes={step.markedNodes}
          currentNode={step.currentNode}
          stepIndex={currentStepIndex}
        />
      </div>

      {/* ── Arc sélectionné ── */}
      {step.selectedEdge && (
        <div className="px-3 py-2.5 border-b border-slate-200 dark:border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Arc sélectionné
          </p>
          <SelectedEdge edge={step.selectedEdge} />
        </div>
      )}

      {/* ── Chemins optimaux ── */}
      {result.optimalPaths.length > 0 && (
        <div className="p-3">
          <button
            onClick={() => setShowPaths((v) => !v)}
            className={cx(
              "w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors duration-150",
              "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Chemins optimaux
            </span>
            <svg
              viewBox="0 0 12 12"
              className={cx(
                "w-3 h-3 transition-transform duration-200",
                showPaths ? "rotate-180" : ""
              )}
              fill="none"
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showPaths && (
            <div className="mt-3">
              <OptimalPaths paths={result.optimalPaths} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
