import { useState } from "react";
import { useGraphStore } from "../../store/graphStore";

export default function StepsPanel() {
  const {
    isComputed,
    isRunning,
    result,
    currentStepIndex,
  } = useGraphStore();

  const [expanded, setExpanded] = useState<number | null>(null);

  if (!isComputed || !result) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          {isRunning ? (
            <span className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <path d="M12 6v6l4 2" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" stroke="#cbd5e1" strokeWidth="2" />
            </svg>
          )}
        </div>
        <p className="text-sm font-medium text-slate-500">
          {isRunning ? "Calcul en cours..." : "Cliquez sur ▶ pour exécuter"}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {isRunning ? "Patientez quelques secondes..." : "Algorithme de Dantzig"}
        </p>
      </div>
    );
  }

  const currentStep = result.steps[currentStepIndex];

  const formatValue = (val: number) => {
    if (val === Infinity) return "∞";
    return String(val);
  };

  return (
    <div className="p-4 flex flex-col gap-3 h-full">
      <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white shadow-lg shadow-yellow-200">
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1">
          Étape {currentStepIndex + 1}/{result.steps.length}
        </p>
        <p className="text-lg font-bold font-mono mb-1">
          {currentStep.description}
        </p>
        <p className="text-xs opacity-90 leading-relaxed">
          {currentStep.explanation}
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
        <h3 className="text-xs font-semibold text-slate-700 mb-3">
          Valeurs des λ
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(currentStep.lambdas).map(([nodeId, lambda]) => (
            <div
              key={nodeId}
              className={`text-[11px] font-mono p-2 rounded-lg border ${
                currentStep.markedNodes.includes(nodeId)
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              } ${currentStep.currentNode === nodeId ? "ring-2 ring-yellow-400" : ""}`}
            >
              <span className="font-bold">
                λ<sub>{nodeId.toUpperCase()}</sub>
              </span>
              <span className="float-right font-bold">
                = {formatValue(lambda)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white">
        <div className="p-3">
          <h4 className="text-xs font-semibold text-slate-700 mb-3">
            Sommets marqués (E<sub>{currentStepIndex + 1}</sub>)
          </h4>
          <div className="flex flex-wrap gap-2">
            {currentStep.markedNodes.map((nodeId, idx) => (
              <span
                key={nodeId}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  currentStep.currentNode === nodeId
                    ? "bg-yellow-500 text-white shadow-md"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {nodeId.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {currentStep.selectedEdge && (
        <div className="border-t border-slate-100 pt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">
              Arc sélectionné
            </p>
            <p className="text-[11px] font-mono text-blue-700">
              {currentStep.selectedEdge.from.toUpperCase()} → {currentStep.selectedEdge.to.toUpperCase()}
              <span className="ml-2 px-2 py-0.5 bg-blue-200 rounded text-blue-900">
                v = {currentStep.selectedEdge.weight}
              </span>
            </p>
          </div>
        </div>
      )}

      {expanded === null && (
        <div className="border-t border-slate-100 pt-3">
          <button
            onClick={() => setExpanded(0)}
            className="w-full text-[10px] text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
          >
            <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voir les chemins optimaux
          </button>
        </div>
      )}

      {expanded !== null && (
        <div className="flex-1 overflow-y-auto border-t border-slate-200">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-700">
                Chemins optimaux
              </h4>
              <button
                onClick={() => setExpanded(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                Fermer
              </button>
            </div>
            <div className="space-y-2">
              {result.optimalPaths.map((path, idx) => (
                <div
                  key={idx}
                  className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg p-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-slate-700 font-semibold">
                      {path.from.toUpperCase()} → {path.to.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    {path.path.map((node, nodeIdx) => (
                      <span key={nodeIdx} className="font-mono">
                        {node.toUpperCase()}
                        {nodeIdx < path.path.length - 1 && (
                          <span className="mx-0.5 text-slate-300">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
