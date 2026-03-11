import GraphCanvas from "../components/graph/GraphCanvas";
import StepsPanel from "../components/graph/StepsPanel";
import GraphControls from "../components/graph/GraphControls";
import { useState } from "react";

export default function GraphPage() {
  const [mode, setMode] = useState("min");
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      
      {/* Header : Plus aéré et moderne */}
      <header className="h-16 px-6 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <span className="font-bold text-sm">Σ</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-800 uppercase">Optimisation</h1>
            <p className="text-[10px] text-slate-500 font-medium leading-none">Algorithme de Dantzig</p>
          </div>
        </div>

        <div className="flex items-center rounded-full gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setMode("min")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                mode === "min" 
                  ? "bg-blue-500 text-white shadow-md" 
                  : "text-blue-700 hover:bg-blue-100"
              }`}
            >
              Min
            </button>
            <button
              onClick={() => setMode("max")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                mode === "max" 
                  ? "bg-blue-500 text-white shadow-md" 
                  : "text-blue-700 hover:bg-blue-100"
              }`}
            >
              Max
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden relative">
        
        {/* Zone du Graphe avec un motif de fond subtil */}
        <div className="flex-1 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
          <GraphCanvas />
          
          {/* Floating Controls : Plus ergonomique qu'un gros footer */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="bg-blue-100 backdrop-blur-2xl border border-blue-100 p-2 rounded-2xl shadow-xl flex gap-1">
               <GraphControls />
            </div>
          </div>
        </div>

        {/* Steps Panel : Collapsible (optionnel) et stylisé */}
        <aside className="w-80 border-l border-slate-200 bg-white flex flex-col shadow-[-4px_0_15px_rgba(0,0,0,0,0.02)]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
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