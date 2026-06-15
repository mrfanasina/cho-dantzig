  import { useState, useEffect, useRef } from "react";
  import GraphCanvas from "../components/graph/GraphCanvas";
  import StepsPanel from "../components/graph/StepsPanel";
  import GraphControls from "../components/graph/GraphControls";
  import GraphEditor from "../components/graph/GraphEditor";
  import AddNodeForm from "../components/AddNodeForm";
  import { useGraphStore } from "../store/graphStore";

  export default function GraphPage() {
    const { 
      nodes, 
      edges, 
      isRunning, 
      error, 
      optimizationType, 
      setOptimizationType, 
      resetResult,
      setNodes,
      setEdges
    } = useGraphStore();
    
    // États d'interface utilisateur (UI)
    const [showEditor, setShowEditor] = useState(false);
    const [addEdgeMode, setAddEdgeMode] = useState(false);
    const [showAddNodeForm, setShowAddNodeForm] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [showHelpModal, setShowHelpModal] = useState(false);
    
    // Nouvel état pour l'effet visuel de survol du fichier (Drag and Drop)
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    // Référence pour le bouton d'importation masqué
    const fileInputRef = useRef(null);

    // UX : Désactiver le mode arête si on ouvre le formulaire d'ajout de sommet
    useEffect(() => {
      if (showAddNodeForm) setAddEdgeMode(false);
    }, [showAddNodeForm]);

    // UX Pro : Raccourcis clavier
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        switch (e.key.toLowerCase()) {
          case "n":
            e.preventDefault();
            setShowAddNodeForm(true);
            break;
          case "e":
            e.preventDefault();
            setAddEdgeMode((prev) => !prev);
            break;
          case "m":
            e.preventDefault();
            setIsDarkMode((prev) => !prev);
            break;
          case "escape":
            setAddEdgeMode(false);
            setShowAddNodeForm(false);
            setShowHelpModal(false);
            break;
          default:
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // --- FONCTION PARSE & INJECT (Partagée entre l'input et le Drag/Drop) ---
    const processGraphFile = (file) => {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result;
          const data = JSON.parse(content);

          if (!data.nodes || !data.edges) {
            throw new Error("Format de fichier invalide structurellement.");
          }

          setNodes(data.nodes);
          setEdges(data.edges);

          if (data.metadata?.optimizationType) {
            setOptimizationType(data.metadata.optimizationType);
          }

          resetResult();
        } catch (error) {
          alert("Fichier JSON invalide pour la cartographie du graphe.");
          console.error(error);
        }
      };
      reader.readAsText(file);
    };

    // --- HANDLERS : CLASSIQUE (BOUTON DE SÉLECTION) ---
    const handleImportJSON = (event) => {
      const file = event.target.files?.[0];
      processGraphFile(file);
      event.target.value = ""; // Reset
    };

    // --- HANDLERS : DRAG & DROP (GLISSER-DÉPOSER GLOBAL) ---
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);

      const file = e.dataTransfer.files?.[0];
      if (file && file.type === "application/json" || file?.name.endsWith(".json")) {
        processGraphFile(file);
      } else {
        alert("Veuillez déposer un fichier au format .json uniquement.");
      }
    };

    // --- EXPORTATION ---
    const handleExportJSON = () => {
      const graphData = {
        metadata: {
          version: "1.0",
          timestamp: new Date().toISOString(),
          optimizationType
        },
        nodes: nodes || [],
        edges: edges || []
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(graphData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `graph-${optimizationType}-${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    };

    const nodeCount = nodes?.length || 0;
    const edgeCount = edges?.length || 0;

    return (
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`h-screen w-screen flex flex-col font-sans overflow-hidden relative select-none transition-colors duration-300 ${
          isDarkMode 
            ? "bg-slate-950 text-slate-100 selection:bg-indigo-500/30" 
            : "bg-slate-50 text-slate-900 selection:bg-indigo-100"
        }`}
      >
        
        {/* 🌌 FLOU INTERACTIF LORS DU DRAG & DROP D'UN FICHIER */}
        {isDraggingFile && (
          <div className="absolute inset-0 bg-indigo-600/10 backdrop-blur-md border-4 border-dashed border-indigo-500 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500 text-white flex items-center justify-center text-2xl mb-4 shadow-xl shadow-indigo-500/20 animate-bounce">
              📥
            </div>
            <h2 className="text-lg font-bold tracking-wide uppercase text-indigo-400">Déposez votre fichier ici</h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">Relâchez pour charger la configuration de votre graphe (.json)</p>
          </div>
        )}

        {/* Input d'importation masqué pour le clic classique */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImportJSON} 
          accept=".json" 
          className="hidden" 
        />

        {/* Arrière-plan : Ambient Luminous Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className={`absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[140px] transition-colors duration-700 ${
            isDarkMode ? "bg-indigo-500/10" : "bg-indigo-500/5"
          }`} />
          <div className={`absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[140px] transition-colors duration-700 ${
            isDarkMode ? "bg-emerald-500/5" : "bg-emerald-500/4"
          }`} />
        </div>

        {/* --- HEADER --- */}
        <header className={`h-14 px-6 flex justify-between items-center sticky top-0 z-30 backdrop-blur-md transition-all duration-300 border-b ${
          isDarkMode 
            ? "border-white/5 bg-slate-900/40 shadow-sm shadow-black/10" 
            : "border-slate-200/60 bg-white/60 shadow-sm shadow-slate-100"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-amber-400 to-amber-500 rounded-lg flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/10 transform hover:scale-105 transition-transform duration-200">
              <span className="font-black text-sm">Σ</span>
            </div>
            <div className="flex flex-col">
              <h1 className={`text-[11px] font-bold tracking-widest uppercase ${
                isDarkMode ? "text-slate-200" : "text-slate-800"
              }`}>
                Chemin Optimal
              </h1>
              <p className="text-[10px] text-amber-500 font-medium tracking-wide">
                Algorithme de Dantzig
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex p-0.5 rounded-lg border backdrop-blur-sm ${
              isDarkMode ? "bg-slate-950/50 border-white/5" : "bg-slate-200/50 border-slate-200"
            }`}>
              {(["min", "max"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOptimizationType(type)}
                  disabled={isRunning}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 uppercase tracking-wider ${
                    optimizationType === type
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm"
                      : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className={`w-px h-5 ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />


            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label="Changer de thème"
              className={`p-1.5 rounded-lg border transition-all duration-200 active:scale-90 ${
                isDarkMode ? "bg-slate-950/40 border-white/10 text-amber-400 hover:bg-slate-800" : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-100 shadow-sm"
              }`}
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.22 4.22l1.58 1.58m12.42 12.42l1.58 1.58M3 12h2.25m13.5 0H21M4.22 19.78l1.58-1.58M17.66 6.34l1.58-1.58M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className={`p-1.5 rounded text-lg font-medium transition-colors ${
                isDarkMode ? "text-slate-400 hover:text-slate-200 hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Raccourcis et Aide"
            >
              ?
            </button>

          </div>
        </header>

        {/* Notification d'erreur */}
        {error && (
          <div className="absolute top-16 right-6 z-50 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs font-semibold text-red-400 shadow-xl backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-top-4 duration-300">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            {error}
          </div>
        )}

        {/* --- MAIN --- */}
        <main className="flex flex-1 overflow-hidden relative z-10">
          
          {/* Éditeur de texte (Volet Gauche) */}
          {showEditor && (
            <div className={`w-80 h-full border-r backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-left duration-300 z-20 ${
              isDarkMode ? "border-white/5 bg-slate-900/40" : "border-slate-200 bg-white/40"
            }`}>
              <GraphEditor />
            </div>
          )}

          {/* Zone Centrale : Le Canevas */}
          <div className={`flex-1 relative transition-colors duration-300 overflow-hidden ${
            isDarkMode 
              ? "bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] bg-slate-950/20" 
              : "bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] bg-slate-50/20"
          } [background-size:28px_28px]`}>
            
            {/* 🛠️ DOCK FLOTTANT AVEC IMPORT/EXPORT */}
            <div className={`absolute top-6 left-6 z-30 flex flex-col gap-1.5 p-1.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
              isDarkMode ? "bg-slate-900/80 border-white/10 shadow-black/50" : "bg-white/90 border-slate-200 shadow-slate-300/60"
            }`}>
              {/* Ajouter Sommet */}
              <button
                onClick={() => setShowAddNodeForm(true)}
                title="Ajouter un sommet (N)"
                className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                  isDarkMode ? "hover:bg-white/10 text-slate-200" : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span className="text-lg font-light">＋</span>
              </button>

              {/* Créer des liaisons */}
              <button
                onClick={() => setAddEdgeMode(!addEdgeMode)}
                title={addEdgeMode ? "Quitter le mode arêtes (E)" : "Lier des sommets (E)"}
                className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 border ${
                  addEdgeMode ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-inner" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </button>

              {/* Toggle Éditeur matriciel */}
              <button
                onClick={() => setShowEditor(!showEditor)}
                title={showEditor ? "Fermer l'éditeur de texte" : "Ouvrir l'éditeur matriciel"}
                className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                  showEditor ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                </svg>
              </button>

              <div className={`h-px w-6 mx-auto ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />

              {/* Bouton Importer JSON */}
              <button
                onClick={() => fileInputRef.current.click()}
                title="Importer un fichier (.json) ou glisser-déposer le fichier sur l'écran"
                className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                  isDarkMode ? "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10" : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </button>

              {/* Bouton Exporter JSON */}
              <button
                onClick={handleExportJSON}
                disabled={nodeCount === 0}
                title={nodeCount === 0 ? "Le graphe est vide" : "Exporter le graphe (.json)"}
                className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                  isDarkMode ? "text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10" : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h3a2 2 0 012 2v11a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>

            {/* Bandeau d'information contextuel */}
            {addEdgeMode && (
              <div className="absolute top-6 left-24 z-30 px-4 py-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 backdrop-blur-md shadow-lg text-[11px] font-medium text-emerald-400 flex items-center gap-2.5 animate-in fade-in slide-in-from-left-3 duration-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Cliquez successivement sur <strong>deux sommets</strong> pour les lier.</span>
                <button onClick={() => setAddEdgeMode(false)} className="ml-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                  Quitter (Echap)
                </button>
              </div>
            )}

            {/* Statistiques */}
            <div className={`absolute bottom-6 left-6 z-30 px-3 py-2 rounded-xl text-[10px] font-mono border backdrop-blur-md flex gap-4 ${
              isDarkMode ? "bg-slate-950/60 border-white/5 text-slate-400" : "bg-white/70 border-slate-200 text-slate-500"
            }`}>
              <div>SOMMETS: <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{nodeCount}</span></div>
              <div className={`w-px h-3 ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />
              <div>ARÊTES: <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{edgeCount}</span></div>
            </div>

            {/* Empty State */}
            {nodeCount === 0 && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mb-4 border border-indigo-500/20">⬡</div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-1">Aucun sommet détecté</h3>
                <p className={`text-[11px] max-w-xs mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Glissez-déposez un fichier JSON n'importe où sur l'écran ou créez un nœud.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddNodeForm(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium rounded-lg shadow-sm transition-all active:scale-95">
                    Créer le premier nœud
                  </button>
                  <button onClick={() => fileInputRef.current.click()} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium rounded-lg shadow-sm transition-all active:scale-95">
                    Importer JSON
                  </button>
                </div>
              </div>
            )}

            <GraphCanvas addEdgeMode={addEdgeMode} onEdgeModeCancel={() => setAddEdgeMode(false)} />
            
            {/* Menu de commandes algo */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
              <div className={`border p-2 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2 transition-all ${
                isDarkMode ? "bg-slate-950/90 border-white/10 shadow-black/80" : "bg-white/95 border-slate-300 shadow-slate-300"
              }`}>
                <GraphControls />
                {isRunning && (
                  <div className={`flex items-center gap-2 pl-3 pr-2 border-l ${isDarkMode ? "border-white/10" : "border-slate-200"}`}>
                    <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 animate-pulse">Calcul...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Volet Latéral Droit */}
          <aside className={`w-90 border-l backdrop-blur-sm flex flex-col transition-colors duration-300 z-20 ${
            isDarkMode ? "border-white/5 bg-slate-900/20" : "border-slate-200 bg-white/30"
          }`}>
            <div className={`p-4 border-b flex justify-between items-center ${
              isDarkMode ? "border-white/5 bg-slate-900/40" : "border-slate-200 bg-slate-100/40"
            }`}>
              <h2 className={`text-xs font-bold tracking-wider uppercase flex items-center gap-2 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                <span className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
                Résolution pas à pas
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
              <StepsPanel />
            </div>
          </aside>
        </main>

        {/* Modal d'ajout de nœud */}
        {showAddNodeForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                <AddNodeForm
                  existingNodes={nodes}
                  onAdd={(node) => {
                    useGraphStore.getState().addNode(node);
                    resetResult();
                    setShowAddNodeForm(false);
                  }}
                  theme={isDarkMode ? "dark" : "light"}
                  onClose={() => setShowAddNodeForm(false)}
                />
          </div>
        )}

        {/* Modal d'aide */}
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${
              isDarkMode ? "bg-slate-900 border-white/10 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-indigo-500">Raccourcis Clavier</h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between"><span className="text-slate-400">Ajouter Sommet</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">N</kbd></div>
                <div className="flex justify-between"><span className="text-slate-400">Mode Arêtes/Liens</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">E</kbd></div>
                <div className="flex justify-between"><span className="text-slate-400">Basculer le Thème</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">M</kbd></div>
                <div className="flex justify-between"><span className="text-slate-400">Annuler / Quitter</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">Echap</kbd></div>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="mt-5 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors">
                Compris !
              </button>
            </div>
          </div>
        )}
      </div>  
    );
  }