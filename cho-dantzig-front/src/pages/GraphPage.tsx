import { useState } from "react";
import GraphCanvas from "../components/graph/GraphCanvas";
import StepsPanel from "../components/graph/StepsPanel";
import GraphControls from "../components/graph/GraphControls";
import GraphEditor from "../components/graph/GraphEditor";
import AddNodeForm from "../components/AddNodeForm";
import { useGraphStore } from "../store/graphStore";

interface GraphCanvasProps {
  addEdgeMode?: boolean;
  onEdgeModeCancel?: () => void;
}

export default function GraphPage() {
  const { isRunning, error, optimizationType, setOptimizationType, addNode, resetResult } = useGraphStore();
  const [showEditor, setShowEditor] = useState(true);
  const [addEdgeMode, setAddEdgeMode] = useState(false);
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // État initialisé en mode sombre premium

  return (
    <div className={`h-screen flex flex-col font-sans overflow-hidden relative transition-colors duration-300 ${
      isDarkMode 
        ? "bg-slate-950 text-slate-100 selection:bg-indigo-500/30" 
        : "bg-slate-50 text-slate-800 selection:bg-indigo-100"
    }`}>
      
      {/* Effets de lumière en arrière-plan (Premium Ambient Glow) adaptés au thème */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
        isDarkMode ? "bg-indigo-500/10" : "bg-indigo-500/5"
      }`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
        isDarkMode ? "bg-emerald-500/5" : "bg-emerald-500/4"
      }`} />

      {/* Header Glassmorphic */}
      <header className={`h-16 px-6 flex justify-between items-center sticky top-0 z-20 shadow-lg backdrop-blur-xl transition-all duration-300 ${
        isDarkMode 
          ? "border-b border-white/5 bg-slate-900/60 shadow-black/20" 
          : "border-b border-slate-200/60 bg-white/70 shadow-slate-100"
      }`}>
        
        
        {/* Branding / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-amber-300 to-yellow-400 rounded-xl flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-transform">
            <span className="font-extrabold text-amber-100">Σ</span>
          </div>
          <div>
            <h1 className={`text-xs font-black tracking-widest uppercase bg-gradient-to-r bg-clip-text text-transparent ${
              isDarkMode ? "from-slate-200 to-slate-400" : "from-slate-700 to-slate-900"
            }`}>
              Optimisation
            </h1>
            <p className="text-[10px] text-amber-500 font-semibold tracking-wider uppercase mt-0.5">
              Algorithme de Dantzig
            </p>
          </div>
        </div>

        {/* Actions / Contrôles du Header */}
        <div className="flex items-center gap-4">
                    {/* Bouton Toggle Éditeur */}
          <button
            onClick={() => setShowEditor(!showEditor)}
            className={`px-4 py-2 border text-xs font-semibold rounded-xl transition-all duration-200 ${
              showEditor 
                ? isDarkMode 
                  ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700" 
                  : "bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300/80"
                : isDarkMode
                  ? "bg-transparent border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                  : "bg-transparent border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {showEditor ? "Masquer Éditeur" : "Afficher Éditeur"}
          </button>

          {/* Bouton Ajouter Sommet (Node) */}
          <button
            onClick={() => setShowAddNodeForm(true)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 active:scale-95 shadow-sm ${
              isDarkMode 
                ? "bg-white/5 border-white/10 hover:bg-white/10 text-slate-200" 
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
            }`}
          >
            <span className={`flex items-center justify-center w-5 h-5 rounded-lg text-xs font-bold ${
              isDarkMode ? "bg-white/10" : "bg-slate-100"
            }`}>+</span>
            Ajouter des sommets
          </button>

          {/* Bouton Mode Arête */}
          <button
            onClick={() => setAddEdgeMode(!addEdgeMode)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-300 shadow-sm active:scale-95 border ${
              addEdgeMode
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30"
                : "bg-indigo-500 to-indigo-600 border-indigo-400/20 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/10"
            }`}
          >
            <span className={`flex items-center justify-center w-5 h-5 rounded-lg text-[11px] transition-transform duration-300 ${
              addEdgeMode ? "bg-emerald-500 text-slate-950 scale-110" : "bg-white/20 text-white"
            }`}>
              {addEdgeMode ? "✓" : "→"}
            </span>
            {addEdgeMode ? "Mode arêtes actif" : "Ajouter des arêtes"}
          </button>

          {/* Sélecteur de type d'optimisation */}
          <div className={`flex p-1 rounded-xl border backdrop-blur-sm transition-colors duration-300 ${
            isDarkMode ? "bg-slate-950/60 border-white/5" : "bg-slate-200/60 border-slate-300/40"
          }`}>
            <button
              onClick={() => setOptimizationType("min")}
              disabled={isRunning}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                optimizationType === "min"
                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/10"
                  : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
              } disabled:opacity-50`}
            >
              Minimisation
            </button>
            <button
              onClick={() => setOptimizationType("max")}
              disabled={isRunning}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                optimizationType === "max"
                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/10"
                  : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
              } disabled:opacity-50`}
            >
              Maximisation
            </button>
          </div>


          {/* Switch Mode Clair / Sombre (Premium) */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle Theme"
            className={`p-2 rounded-xl border transition-all duration-300 active:scale-90 ${
              isDarkMode 
                ? "bg-slate-950/40 border-white/10 text-amber-400 hover:bg-slate-800" 
                : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-100 shadow-sm"
            }`}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.22 4.22l1.58 1.58m12.42 12.42l1.58 1.58M3 12h2.25m13.5 0H21M4.22 19.78l1.58-1.58M17.66 6.34l1.58-1.58M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {/* Status d'erreur / calcul */}
          {error && (
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-medium text-red-400 animate-fade-in">
              {error}
            </div>
          )}
          {isRunning && (
            <div className={`flex items-center gap-2.5 px-4 py-2 border rounded-xl backdrop-blur-sm transition-colors duration-300 ${
              isDarkMode ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"
            }`}>
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              <span className={`text-xs font-semibold tracking-wide ${isDarkMode ? "text-amber-300" : "text-amber-700"}`}>
                Calcul en cours...
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden relative z-10">
        
        {/* Éditeur de Graphe (Panel Gauche) */}
        {showEditor && (
          <div className={`border-r backdrop-blur-md transition-all duration-300 ${
            isDarkMode ? "border-white/5 bg-slate-900/40" : "border-slate-200 bg-white/40"
          }`}>
            <GraphEditor />
          </div>
        )}

        {/* Zone Centrale : Canevas du Graphe */}
        <div className={`flex-1 relative transition-colors duration-300 ${
          isDarkMode 
            ? "bg-[radial-gradient(#334155_1px,transparent_1px)] bg-slate-950/40" 
            : "bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-slate-50/40"
        } [background-size:20px_20px]`}>
          
          <GraphCanvas addEdgeMode={addEdgeMode} />
          
          {/* Menu flottant des contrôles de l'algorithme */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center">
            <div className={`border p-2.5 rounded-2xl shadow-2xl backdrop-blur-xl flex gap-1 transition-all ${
              isDarkMode 
                ? "bg-slate-900/80 border-white/10 shadow-black/40 hover:border-white/20" 
                : "bg-slate-200 border-slate-300 shadow-slate-400"
            }`}>
               <GraphControls />
            </div>
          </div>
        </div>

        {/* Volet Latéral Droit : Étapes de résolution */}
        <aside className={`w-85 border-l backdrop-blur-md flex flex-col shadow-2xl transition-colors duration-300 ${
          isDarkMode ? "border-white/5 bg-slate-900/40" : "border-slate-200 bg-white/40"
        }`}>
          <div className={`p-4 border-b backdrop-blur-sm ${
            isDarkMode ? "border-white/5 bg-slate-900/60" : "border-slate-200 bg-slate-100/60"
          }`}>
            <h2 className={`text-xs font-bold tracking-wider uppercase flex items-center gap-2 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              <span className="w-2 h-2 bg-amber-400 rounded-full shadow-sm shadow-amber-400/50" />
              Étapes de résolution
            </h2>
          </div>
          <div className={`flex-1 overflow-y-auto scrollbar-thin transition-colors duration-300 ${
            isDarkMode ? "scrollbar-thumb-slate-800" : "scrollbar-thumb-slate-200"
          } scrollbar-track-transparent`}>
            <StepsPanel />
          </div>
        </aside>
      </main>

      {/* Rendu conditionnel du Modal de formulaire d'ajout de nœud */}
      {showAddNodeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`border rounded-2xl p-1 shadow-2xl max-w-md w-full overflow-hidden transition-colors duration-300 ${
            isDarkMode ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"
          }`}>
            <AddNodeForm
              onAdd={(node) => {
                addNode(node);
                resetResult();
                setShowAddNodeForm(false);
              }}
              onClose={() => setShowAddNodeForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}