import { useState } from "react";
import GraphCanvas from "../components/graph/GraphCanvas";
import StepsPanel from "../components/graph/StepsPanel";
import GraphControls from "../components/graph/GraphControls";
import GraphEditor from "../components/graph/GraphEditor";
import { useGraphStore } from "../store/graphStore";

export default function GraphPage() {
  const { isRunning, error, optimizationType, setOptimizationType } = useGraphStore();
  const [showEditor, setShowEditor] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      
      {/* Header */}
      <header className="h-16 px-6 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-yellow-200">
            <span className="font-bold text-sm">Σ</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-800 uppercase">Optimisation</h1>
            <p className="text-[10px] text-slate-500 font-medium leading-none">Algorithme de Dantzig</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setOptimizationType("min")}
              disabled={isRunning}
              className={`px-4 py-1 rounded-md text-xs font-medium transition-colors ${
                optimizationType === "min" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Minimisation
            </button>
            <button
              onClick={() => setOptimizationType("max")}
              disabled={isRunning}
              className={`px-4 py-1 rounded-md text-xs font-medium transition-colors ${
                optimizationType === "max" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Maximisation
            </button>
          </div>

          <button
            onClick={() => setShowEditor(!showEditor)}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200"
          >
            {showEditor ? "Masquer Éditeur" : "Afficher Éditeur"}
          </button>
          {error && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}
          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span className="text-xs text-yellow-700 font-medium">Calcul en cours...</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden relative">
        
        {showEditor && <GraphEditor />}

        <div className="flex-1 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
          <GraphCanvas />
          
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="bg-slate-200 border border-slate-300 p-2 rounded-2xl shadow-xl flex gap-1">
               <GraphControls />
            </div>
          </div>
        </div>

        <aside className="w-80 border-l border-slate-200 bg-white flex flex-col shadow-[-4px_0_15px_rgba(0,0,0,0,0.02)]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Étapes de résolution
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <StepsPanel />
          </div>
        </aside>
      </main>

    </div>
  );
}