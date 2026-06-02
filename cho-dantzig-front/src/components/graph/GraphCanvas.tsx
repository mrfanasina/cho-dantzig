import { useState, useRef, useCallback } from "react";
import { useGraphStore } from "../../store/graphStore";
import type { GraphNode, GraphEdge, NodeColors } from "../../types/graph";

export default function GraphCanvas() {
  const {
    nodes,
    edges,
    setNodes,
    getNodeLambda,
    isNodeMarked,
    isCurrentNode,
    isSelectedEdge,
    isNodeInOptimalPath,
    isEdgeInOptimalPath,
  } = useGraphStore();

  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const dragOffset = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const safeNodes = (nodes || []).map((node) => ({
    ...node,
    x: typeof node.x === 'number' && !isNaN(node.x) ? node.x : 400,
    y: typeof node.y === 'number' && !isNaN(node.y) ? node.y : 250,
  }));

  const safeEdges = edges || [];

  const getNode = (id: string) =>
    safeNodes.find((n) => n.id === id);

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

  const onMouseDownNode = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();

      setSelected(id);

      const node = safeNodes.find((n) => n.id === id);

      if (!node || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();

      dragOffset.current = {
        x: e.clientX - rect.left - node.x,
        y: e.clientY - rect.top - node.y,
      };

      setDragging(id);
    },
    [safeNodes]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();

      setNodes((prev) =>
        (prev || []).map((n) =>
          n.id === dragging
            ? {
                ...n,
                x: Math.max(
                  30,
                  Math.min(
                    rect.width - 30,
                    e.clientX - rect.left - dragOffset.current.x
                  )
                ),
                y: Math.max(
                  30,
                  Math.min(
                    rect.height - 30,
                    e.clientY - rect.top - dragOffset.current.y
                  )
                ),
              }
            : n
        )
      );
    },
    [dragging, setNodes]
  );

  const onMouseUp = () => setDragging(null);

  const nodeColor = (node: GraphNode): NodeColors => {
    try {
      const isOptimal = isNodeInOptimalPath(node.id);
      const isMarked = isNodeMarked(node.id);
      const isCurrent = isCurrentNode(node.id);

      if (isOptimal) {
        return {
          fill: "#1d4ed8",
          stroke: "#3b82f6",
          text: "#fff",
        };
      }

      if (isCurrent) {
        return {
          fill: "#fbbf24",
          stroke: "#f59e0b",
          text: "#000",
        };
      }

      if (isMarked) {
        return {
          fill: "#facc15",
          stroke: "#eab308",
          text: "#000",
        };
      }
    } catch (e) {
    }

    return {
      fill: "#fff",
      stroke: "#94a3b8",
      text: "#334155",
    };
  };

  const edgeColor = (edge: GraphEdge) => {
    try {
      const isOptimal = isEdgeInOptimalPath(edge.from, edge.to);
      if (isOptimal) return "#1d4ed8";
      if (isSelectedEdge(edge.from, edge.to)) return "#f59e0b";
      if (hovered === edge.id) return "#64748b";
    } catch (e) {
    }
    return "#cbd5e1";
  };

  let lambda: number | null = null;
  try {
    lambda = getNodeLambda('dummy');
  } catch (e) {
  }

  return (
    <svg
      ref={svgRef}
      className="w-full h-full select-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={() => setSelected(null)}
    >

      <defs>

        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#cbd5e1" />
        </marker>

        <marker
          id="arrow-selected"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
        </marker>

        <marker
          id="arrow-optimal"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#1d4ed8" />
        </marker>

        <filter
          id="node-shadow"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodOpacity="0.12"
          />
        </filter>

      </defs>

      {safeEdges.map((edge) => {
        try {
          const mid = getMidpoint(edge);
          const selected = isSelectedEdge(edge.from, edge.to);
          const optimal = isEdgeInOptimalPath(edge.from, edge.to);

          return (
            <g
              key={edge.id}
              onMouseEnter={() => setHovered(edge.id)}
              onMouseLeave={() => setHovered(null)}
            >

              <path
                d={getEdgePath(edge)}
                fill="none"
                stroke={edgeColor(edge)}
                strokeWidth={selected || optimal ? 3 : 2}
                markerEnd={optimal ? "url(#arrow-optimal)" : selected ? "url(#arrow-selected)" : "url(#arrow)"}
              />

              <rect
                x={mid.x - 13}
                y={mid.y - 10}
                width={26}
                height={20}
                rx={6}
                fill={optimal ? "#dbeafe" : selected ? "#fef3c7" : "#f8fafc"}
                stroke={optimal ? "#3b82f6" : selected ? "#fbbf24" : "#e2e8f0"}
              />

              <text
                x={mid.x}
                y={mid.y + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight="600"
                fill={optimal ? "#1e40af" : selected ? "#92400e" : "#64748b"}
              >
                {edge.weight}
              </text>

            </g>
          );
        } catch (e) {
          return null;
        }
      })}

      {safeNodes.map((node) => {
        try {
          const colors = nodeColor(node);
          let lambdaVal = null;
          try {
            lambdaVal = getNodeLambda(node.id);
          } catch (e) {
          }
          const isSel = selected === node.id;
          let isMarked = false;
          let isCurrent = false;
          try {
            isMarked = isNodeMarked(node.id);
            isCurrent = isCurrentNode(node.id);
          } catch (e) {
          }

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onMouseDown={(e) => onMouseDownNode(e, node.id)}
              style={{
                cursor: dragging === node.id ? "grabbing" : "grab",
              }}
              filter="url(#node-shadow)"
            >

              {(lambdaVal !== null && lambdaVal !== undefined) && (
                <g transform="translate(0,-42)">

                  <rect
                    x={-24}
                    y={-12}
                    width={48}
                    height={22}
                    rx={6}
                    fill={isCurrent ? "#fef3c7" : isMarked ? "#fef9c3" : "#f1f5f9"}
                    stroke={isCurrent ? "#f59e0b" : isMarked ? "#eab308" : "#cbd5e1"}
                  />

                  <text
                    textAnchor="middle"
                    y="3"
                    fontSize={12}
                    fontWeight="700"
                    fontFamily="serif"
                    fill={isCurrent ? "#92400e" : isMarked ? "#854d0e" : "#334155"}
                  >
                    λ={lambdaVal}
                  </text>

                </g>
              )}

              <circle
                r={22}
                fill={colors.fill}
                stroke={isSel ? "#3b82f6" : colors.stroke}
                strokeWidth={isCurrent ? 3 : 2}
              />

              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight="700"
                fill={colors.text}
              >
                {node.label}
              </text>

            </g>
          );
        } catch (e) {
          return null;
        }
      })}
    </svg>
  );
}
