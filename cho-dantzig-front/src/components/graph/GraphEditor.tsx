import { useRef, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import type { GraphNode, GraphEdge } from "../../types/graph";
import AddNodeForm from "../AddNodeForm";


export default function GraphEditor() {
  const {
    nodes,
    edges,
    addNode,
    addEdge,
    updateNode,
    updateEdge,
    removeNode,
    removeEdge,
    sourceNode,
    setNodes,
    setEdges,
    setSourceNode,
    resetResult,
  } = useGraphStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newNodeId, setNewNodeId] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeX, setNewNodeX] = useState("400");
  const [newNodeY, setNewNodeY] = useState("250");

  const [newEdgeFrom, setNewEdgeFrom] = useState(nodes[0]?.id || "");
  const [newEdgeTo, setNewEdgeTo] = useState(nodes[1]?.id || "");
  const [newEdgeWeight, setNewEdgeWeight] = useState("1");

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeId) return;

    addNode({
      id: newNodeId.toLowerCase(),
      label: newNodeLabel || newNodeId.toUpperCase(),
      x: parseInt(newNodeX) || 400,
      y: parseInt(newNodeY) || 250,
      type: "normal",
    });

    setNewNodeId("");
    setNewNodeLabel("");
    resetResult();
  };

  const handleAddEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEdgeFrom || !newEdgeTo || newEdgeFrom === newEdgeTo) return;

    const id = `e-${Date.now()}`;
    addEdge({
      id,
      from: newEdgeFrom,
      to: newEdgeTo,
      weight: parseInt(newEdgeWeight) || 1,
      flow: 0,
    });

    setNewEdgeWeight("1");
    resetResult();
  };


    const handleImport = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;

        const data = JSON.parse(content);

        if (!data.nodes || !data.edges) {
          throw new Error("Format invalide");
        }

        setNodes(data.nodes);
        setEdges(data.edges);

        resetResult();
      } catch (error) {
        alert("Fichier JSON invalide");
        console.error(error);
      }
    };

    reader.readAsText(file);
  };
  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col shadow-[4px_0_15px_rgba(0,0,0,0,0.02)]">
      
    {showAddNodeForm && (
      <AddNodeForm
        onAdd={(node) => {
          addNode(node);
          resetResult();
        }}
        onClose={() => setShowAddNodeForm(false)}
      />
)}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          Éditeur de Graphe
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        <div>
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
            Nœuds
          </h3>

          <form onSubmit={handleAddNode} className="space-y-2 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  ID
                </label>
                <input
                  type="text"
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value)}
                  placeholder="ex: a"
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  placeholder="ex: A"
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  X
                </label>
                <input
                  type="number"
                  value={newNodeX}
                  onChange={(e) => setNewNodeX(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  Y
                </label>
                <input
                  type="number"
                  value={newNodeY}
                  onChange={(e) => setNewNodeY(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!newNodeId}
              className="w-full py-2 px-3 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Ajouter un nœud
            </button>

            <button
              onClick={() => setShowAddNodeForm(!showAddNodeForm)}
              className="w-full py-2 px-3 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Ajouter plusieurs nœuds
            </button>
          </form>

          <div className="space-y-2">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {node.label}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        {node.label}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {node.x}, {node.y}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSourceNode(node.id)}
                      className={`p-1 rounded ${
                        sourceNode === node.id
                          ? "bg-yellow-100 text-yellow-700"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="Nœud source"
                    >
                      {sourceNode === node.id && (
                        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
                          <path d="M8 2L3 7h3v7h4V7h3L8 2z" />
                        </svg>
                      )}
                      {sourceNode !== node.id && (
                        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 2L3 7h3v7h4V7h3L8 2z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        removeNode(node.id);
                        resetResult();
                      }}
                      className="p-1 text-red-400 hover:text-red-600 rounded"
                      title="Supprimer"
                    >
                      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                {editingNodeId === node.id ? (
                  <NodeEditor
                    node={node}
                    onSave={(updates) => {
                      updateNode(node.id, updates);
                      setEditingNodeId(null);
                      resetResult();
                    }}
                    onCancel={() => setEditingNodeId(null)}
                  />
                ) : (
                  <button
                    onClick={() => setEditingNodeId(node.id)}
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    Modifier
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
            Arcs
          </h3>

          <form onSubmit={handleAddEdge} className="space-y-2 mb-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  De
                </label>
                <select
                  value={newEdgeFrom}
                  onChange={(e) => setNewEdgeFrom(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end justify-center">
                <span className="text-slate-300 text-lg pb-1">→</span>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  Vers
                </label>
                <select
                  value={newEdgeTo}
                  onChange={(e) => setNewEdgeTo(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">
                Poids
              </label>
              <input
                type="number"
                value={newEdgeWeight}
                onChange={(e) => setNewEdgeWeight(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={!newEdgeFrom || !newEdgeTo || newEdgeFrom === newEdgeTo}
              className="w-full py-2 px-3 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Ajouter un arc
            </button>
          </form>

          <div className="space-y-2">
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode = nodes.find((n) => n.id === edge.to);
              return (
                <div
                  key={edge.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-600">
                        {fromNode?.label || edge.from} → {toNode?.label || edge.to}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded">
                        {edge.weight}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        removeEdge(edge.id);
                        resetResult();
                      }}
                      className="p-1 text-red-400 hover:text-red-600 rounded"
                      title="Supprimer"
                    >
                      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {editingEdgeId === edge.id ? (
                    <EdgeEditor
                      edge={edge}
                      nodes={nodes}
                      onSave={(updates) => {
                        updateEdge(edge.id, updates);
                        setEditingEdgeId(null);
                        resetResult();
                      }}
                      onCancel={() => setEditingEdgeId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingEdgeId(edge.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      <div className="flex gap-2">

        {/* importer du nodes et du edges en json  */}
        <button
          onClick={() => { fileInputRef.current?.click()}}
          className="flex-1 py-1.5 px-2 bg-blue-500 text-white text-[10px] font-semibold rounded-lg"
        >
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImport}
          />
          Importer
        </button>
        {/* importer du nodes et du edges en json  */}
        <button
          onClick={() => {
            const graphData = {
              nodes,
              edges,
            };

            const blob = new Blob(
              [JSON.stringify(graphData, null, 2)],
              { type: "application/json" }
            );

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "graph.json";
            a.click();

            URL.revokeObjectURL(url);
          }}
          className="flex-1 py-1.5 px-2 bg-slate-200 text-slate-600 text-[10px] font-semibold rounded-lg"
        >
          Exporter
        </button>
      </div>
      </div>
    </div>
  );
}

function NodeEditor({
  node,
  onSave,
  onCancel,
}: {
  node: GraphNode;
  onSave: (updates: Partial<GraphNode>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [x, setX] = useState(String(node.x));
  const [y, setY] = useState(String(node.y));

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200">
      <div>
        <label className="block text-[10px] font-medium text-slate-500 mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">
            X
          </label>
          <input
            type="number"
            value={x}
            onChange={(e) => setX(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">
            Y
          </label>
          <input
            type="number"
            value={y}
            onChange={(e) => setY(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ label, x: parseInt(x), y: parseInt(y) })}
          className="flex-1 py-1.5 px-2 bg-blue-500 text-white text-[10px] font-semibold rounded-lg"
        >
          Enregistrer
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 px-2 bg-slate-200 text-slate-600 text-[10px] font-semibold rounded-lg"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function EdgeEditor({
  edge,
  nodes,
  onSave,
  onCancel,
}: {
  edge: GraphEdge;
  nodes: GraphNode[];
  onSave: (updates: Partial<GraphEdge>) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState(edge.from);
  const [to, setTo] = useState(edge.to);
  const [weight, setWeight] = useState(String(edge.weight));

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">
            De
          </label>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">
            Vers
          </label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-slate-500 mb-1">
          Poids
        </label>
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ from, to, weight: parseInt(weight) })}
          className="flex-1 py-1.5 px-2 bg-blue-500 text-white text-[10px] font-semibold rounded-lg"
        >
          Enregistrer
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 px-2 bg-slate-200 text-slate-600 text-[10px] font-semibold rounded-lg"
        >
          Annuler
        </button>
      </div>

    </div>
  );
}
