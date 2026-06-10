// components/graph/GraphCanvas.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";
import type { GraphNode, GraphEdge, NodeColors } from "../../types/graph";

interface GraphCanvasProps {
  addEdgeMode?: boolean;
  onEdgeModeCancel?: () => void;
}

interface PendingEdge {
  fromId: string;
  toId: string;
  midX: number;
  midY: number;
}

export default function GraphCanvas({ addEdgeMode = false, onEdgeModeCancel }: GraphCanvasProps) {
  const {
    nodes,
    edges,
    setCanvasSize,
    getNodeLambda,
    isNodeMarked,
    isCurrentNode,
    isSelectedEdge,
    isNodeInOptimalPath,
    isEdgeInOptimalPath,
    moveNode,
    addEdge,
  } = useGraphStore();

  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Add-edge mode state
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  const [weightInput, setWeightInput] = useState<string>("");
  const weightInputRef = useRef<HTMLInputElement>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!addEdgeMode) {
      setEdgeSource(null);
      setCursorPos(null);
      setPendingEdge(null);
      setWeightInput("");
    }
  }, [addEdgeMode]);

  useEffect(() => {
    if (pendingEdge && weightInputRef.current) {
      setTimeout(() => weightInputRef.current?.focus(), 50);
    }
  }, [pendingEdge]);

  const safeNodes = (nodes || []).map((node) => ({
    ...node,
    x: typeof node.x === "number" && !isNaN(node.x) ? node.x : 400,
    y: typeof node.y === "number" && !isNaN(node.y) ? node.y : 250,
  }));

  const safeEdges = edges || [];

  const getNode = (id: string) => safeNodes.find((n) => n.id === id);

  const getEdgePath = (edge: GraphEdge) => {
    const from = getNode(edge.from);
    const to = getNode(edge.to);
    if (!from || !to) return "";
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return "";
    const nx = dx / len;
    const ny = dy / len;
    const r = 22;
    const x1 = from.x + nx * r;
    const y1 = from.y + ny * r;
    const x2 = to.x - nx * r;
    const y2 = to.y - ny * r;
    const mx = (x1 + x2) / 2 - ny * 20;
    const my = (y1 + y2) / 2 + nx * 20;
    return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  };

  const getPreviewPath = (fromId: string, tx: number, ty: number) => {
    const from = getNode(fromId);
    if (!from) return "";
    const dx = tx - from.x;
    const dy = ty - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return "";
    const nx = dx / len;
    const ny = dy / len;
    const x1 = from.x + nx * 22;
    const y1 = from.y + ny * 22;
    const mx = (x1 + tx) / 2 - ny * 20;
    const my = (y1 + ty) / 2 + nx * 20;
    return `M ${x1} ${y1} Q ${mx} ${my} ${tx} ${ty}`;
  };

  const getMidpoint = (edge: GraphEdge) => {
    const from = getNode(edge.from);
    const to = getNode(edge.to);
    if (!from || !to) return { x: 0, y: 0 };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const nx = -dy / len;
    const ny = dx / len;
    return {
      x: (from.x + to.x) / 2 + nx * 20,
      y: (from.y + to.y) / 2 + ny * 20,
    };
  };

  const getSvgCoords = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const zoomIn = useCallback(() => setZoom((z) => Math.min(3, z * 1.01)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.3, z / 1.01)), []);

  const fitView = useCallback(() => {
    if (!svgRef.current || safeNodes.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const padding = 100;

    const minX = Math.min(...safeNodes.map((n) => n.x)) - padding;
    const maxX = Math.max(...safeNodes.map((n) => n.x)) + padding;
    const minY = Math.min(...safeNodes.map((n) => n.y)) - padding;
    const maxY = Math.max(...safeNodes.map((n) => n.y)) + padding;

    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);

    const nextZoom = Math.max(
      0.3,
      Math.min(3, Math.min(rect.width / graphWidth, rect.height / graphHeight))
    );

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(nextZoom);
    setPan({
      x: rect.width / 2 - centerX * nextZoom,
      y: rect.height / 2 - centerY * nextZoom,
    });
  }, [safeNodes]);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.3, Math.min(3, z * factor)));
  }, []);

  const onNodeClickAddMode = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (pendingEdge) return;

      if (!edgeSource) {
        setEdgeSource(id);
      } else if (edgeSource === id) {
        setEdgeSource(null);
        setCursorPos(null);
      } else {
        const from = safeNodes.find((n) => n.id === edgeSource);
        const to = safeNodes.find((n) => n.id === id);
        if (!from || !to) return;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = len > 0 ? -dy / len : 0;
        const ny = len > 0 ? dx / len : 0;
        setPendingEdge({
          fromId: edgeSource,
          toId: id,
          midX: (from.x + to.x) / 2 + nx * 20,
          midY: (from.y + to.y) / 2 + ny * 20,
        });
        setCursorPos(null);
        setWeightInput("");
      }
    },
    [edgeSource, pendingEdge, safeNodes]
  );

  const confirmEdge = useCallback(() => {
    if (!pendingEdge) return;
    const w = parseFloat(weightInput);
    if (isNaN(w) || w <= 0) return;
    addEdge?.({
      id: `e_${pendingEdge.fromId}_${pendingEdge.toId}_${Date.now()}`,
      from: pendingEdge.fromId,
      to: pendingEdge.toId,
      weight: w,
      flow: 0,
    });
    setPendingEdge(null);
    setEdgeSource(null);
    setWeightInput("");
  }, [pendingEdge, weightInput, addEdge]);

  const cancelPendingEdge = useCallback(() => {
    setPendingEdge(null);
    setEdgeSource(null);
    setWeightInput("");
  }, []);

  const onMouseDownNode = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (addEdgeMode) return;
      e.stopPropagation();
      setSelected(id);
      const node = safeNodes.find((n) => n.id === id);
      if (!node || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: (e.clientX - rect.left - pan.x) / zoom - node.x,
        y: (e.clientY - rect.top - pan.y) / zoom - node.y,
      };
      setDragging(id);
    },
    [addEdgeMode, safeNodes]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (addEdgeMode && edgeSource && !pendingEdge) {
        setCursorPos(getSvgCoords(e));
        return;
      }
      if (!dragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      moveNode(dragging, x, y);
    },
    [addEdgeMode, edgeSource, pendingEdge, dragging, moveNode]
  );

  const onMouseUp = () => setDragging(null);

  const onSvgClick = (e: React.MouseEvent) => {
    if (addEdgeMode) {
      if (pendingEdge) cancelPendingEdge();
      else { setEdgeSource(null); setCursorPos(null); }
      return;
    }
    setSelected(null);
  };

  const nodeColor = (node: GraphNode): NodeColors => {
    try {
      if (addEdgeMode) {
        if (edgeSource === node.id) return { fill: "#2563eb", stroke: "#3b82f6", text: "#fff" };
        if (pendingEdge?.toId === node.id) return { fill: "#7c3aed", stroke: "#a78bfa", text: "#fff" };
        return { fill: "#fff", stroke: "#94a3b8", text: "#334155" };
      }
      const isOptimal = isNodeInOptimalPath(node.id);
      const isMarked = isNodeMarked(node.id);
      const isCurrent = isCurrentNode(node.id);
      if (isOptimal) return { fill: "#1d4ed8", stroke: "#3b82f6", text: "#fff" };
      if (isCurrent) return { fill: "#fbbf24", stroke: "#f59e0b", text: "#000" };
      if (isMarked) return { fill: "#facc15", stroke: "#eab308", text: "#000" };
    } catch (_) {}
    return { fill: "#fff", stroke: "#94a3b8", text: "#334155" };
  };

  const edgeColor = (edge: GraphEdge) => {
    try {
      if (isEdgeInOptimalPath(edge.from, edge.to)) return "#1d4ed8";
      if (isSelectedEdge(edge.from, edge.to)) return "#f59e0b";
      if (hovered === edge.id) return "#64748b";
    } catch (_) {}
    return "#cbd5e1";
  };


  useEffect(() => {
    const zin = () => zoomIn();
    const zout = () => zoomOut();
    const fit = () => fitView();

    window.addEventListener("graph-zoom-in", zin);
    window.addEventListener("graph-zoom-out", zout);
    window.addEventListener("graph-fit-view", fit);

    return () => {
      window.removeEventListener("graph-zoom-in", zin);
      window.removeEventListener("graph-zoom-out", zout);
      window.removeEventListener("graph-fit-view", fit);
    };
  }, [zoomIn, zoomOut, fitView]);

  useEffect(() => {
    if (!svgRef.current) return;
    const updateSize = () => {
      const rect = svgRef.current!.getBoundingClientRect();
      setCanvasSize(rect.width, rect.height);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [setCanvasSize]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full select-none"
      style={{ cursor: addEdgeMode ? (edgeSource ? "crosshair" : "cell") : "default" }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={onSvgClick}
      onWheel={onWheel}
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#cbd5e1" />
        </marker>
        <marker id="arrow-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
        </marker>
        <marker id="arrow-optimal" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#1d4ed8" />
        </marker>
        <marker id="arrow-preview" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
        </marker>
        <marker id="arrow-pending" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" />
        </marker>
        <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
        </filter>
        <filter id="glow-blue" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#3b82f6" floodOpacity="0.5" />
        </filter>
        <filter id="glow-purple" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#7c3aed" floodOpacity="0.5" />
        </filter>
      </defs>

      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
      {/* Existing edges */}
      {safeEdges.map((edge) => {
        try {
          const mid = getMidpoint(edge);
          const sel = isSelectedEdge(edge.from, edge.to);
          const optimal = isEdgeInOptimalPath(edge.from, edge.to);
          return (
            <g key={edge.id} onMouseEnter={() => setHovered(edge.id)} onMouseLeave={() => setHovered(null)}>
              <path
                d={getEdgePath(edge)}
                fill="none"
                stroke={edgeColor(edge)}
                strokeWidth={sel || optimal ? 3 : 2}
                markerEnd={optimal ? "url(#arrow-optimal)" : sel ? "url(#arrow-selected)" : "url(#arrow)"}
              />
              <rect x={mid.x - 13} y={mid.y - 10} width={26} height={20} rx={6}
                fill={optimal ? "#dbeafe" : sel ? "#fef3c7" : "#f8fafc"}
                stroke={optimal ? "#3b82f6" : sel ? "#fbbf24" : "#e2e8f0"} />
              <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={11} fontWeight="600"
                fill={optimal ? "#1e40af" : sel ? "#92400e" : "#64748b"}>
                {edge.weight}
              </text>
            </g>
          );
        } catch (_) { return null; }
      })}

      {/* Live preview arrow */}
      {addEdgeMode && edgeSource && cursorPos && !pendingEdge && (
        <path
          d={getPreviewPath(edgeSource, cursorPos.x, cursorPos.y)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 4"
          markerEnd="url(#arrow-preview)"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Locked pending edge */}
      {pendingEdge && (() => {
        const from = getNode(pendingEdge.fromId);
        const to = getNode(pendingEdge.toId);
        if (!from || !to) return null;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return null;
        const nx = dx / len;
        const ny = dy / len;
        const x1 = from.x + nx * 22;
        const y1 = from.y + ny * 22;
        const x2 = to.x - nx * 22;
        const y2 = to.y - ny * 22;
        const cx = (x1 + x2) / 2 - (dy / len) * 20;
        const cy = (y1 + y2) / 2 + (dx / len) * 20;
        return (
          <path
            d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
            fill="none"
            stroke="#7c3aed"
            strokeWidth={2.5}
            strokeDasharray="6 3"
            markerEnd="url(#arrow-pending)"
            style={{ pointerEvents: "none" }}
          />
        );
      })()}

      {/* Nodes */}
      {safeNodes.map((node) => {
        try {
          const colors = nodeColor(node);
          let lambdaVal = null;
          try { lambdaVal = getNodeLambda(node.id); } catch (_) {}
          const isSel = selected === node.id;
          let isMarked = false;
          let isCurrent = false;
          try {
            isMarked = isNodeMarked(node.id);
            isCurrent = isCurrentNode(node.id);
          } catch (_) {}
          const isEdgeSrc = addEdgeMode && edgeSource === node.id;
          const isEdgeTgt = addEdgeMode && pendingEdge?.toId === node.id;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onMouseDown={(e) => onMouseDownNode(e, node.id)}
              onClick={(e) => addEdgeMode && onNodeClickAddMode(e, node.id)}
              style={{ cursor: addEdgeMode ? "pointer" : dragging === node.id ? "grabbing" : "grab" }}
              filter={isEdgeSrc ? "url(#glow-blue)" : isEdgeTgt ? "url(#glow-purple)" : "url(#node-shadow)"}
            >
              {isEdgeSrc && (
                <circle r={30} fill="none" stroke="#3b82f6" strokeWidth={2} opacity={0.4} strokeDasharray="4 3">
                  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
                </circle>
              )}

              {lambdaVal !== null && lambdaVal !== undefined && (
                <g transform="translate(0,-42)">
                  <rect x={-24} y={-12} width={48} height={22} rx={6}
                    fill={isCurrent ? "#fef3c7" : isMarked ? "#fef9c3" : "#f1f5f9"}
                    stroke={isCurrent ? "#f59e0b" : isMarked ? "#eab308" : "#cbd5e1"} />
                  <text textAnchor="middle" y="3" fontSize={12} fontWeight="700" fontFamily="serif"
                    fill={isCurrent ? "#92400e" : isMarked ? "#854d0e" : "#334155"}>
                    λ={lambdaVal}
                  </text>
                </g>
              )}

              <circle
                r={22}
                fill={colors.fill}
                stroke={isEdgeSrc ? "#3b82f6" : isEdgeTgt ? "#7c3aed" : isSel ? "#3b82f6" : colors.stroke}
                strokeWidth={isCurrent || isEdgeSrc || isEdgeTgt ? 3 : 2}
              />
              <text textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="700"
                fill={colors.text} style={{ pointerEvents: "none" }}>
                {node.label}
              </text>
            </g>
          );
        } catch (_) { return null; }
      })}

      {/* Floating weight input */}
      </g>

      {pendingEdge && (
        <foreignObject
          x={pendingEdge.midX - 76}
          y={pendingEdge.midY - 40}
          width={152}
          height={80}
          style={{ overflow: "visible" }}
        >
          <div
            style={{
              background: "white",
              border: "1.5px solid #a78bfa",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(124,58,237,0.18)",
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Poids de l'arc
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                ref={weightInputRef}
                type="number"
                min={1}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmEdge();
                  if (e.key === "Escape") cancelPendingEdge();
                }}
                placeholder="ex: 5"
                style={{
                  width: 64,
                  padding: "4px 7px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "1.5px solid #ddd6fe",
                  borderRadius: 6,
                  outline: "none",
                  color: "#4c1d95",
                  background: "#faf5ff",
                  fontFamily: "monospace",
                }}
              />
              <button
                onClick={confirmEdge}
                style={{
                  flex: 1,
                  background: "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                OK
              </button>
              <button
                onClick={cancelPendingEdge}
                style={{
                  width: 26,
                  background: "#f1f5f9",
                  color: "#94a3b8",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 400,
                  cursor: "pointer",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
