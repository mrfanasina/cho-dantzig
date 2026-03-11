// components/graph/GraphCanvas.tsx

import { useState, useRef, useCallback } from "react";

type NodeType = "source" | "sink" | "normal";

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: NodeType;
  lambda?: number;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  flow: number;
}

interface NodeColors {
  fill: string;
  stroke: string;
  text: string;
}

const INITIAL_NODES: GraphNode[] = [
  { id: "s", label: "S", x: 120, y: 240, type: "source", lambda: 0 },
  { id: "a", label: "A", x: 300, y: 120, type: "normal", lambda: 4 },
  { id: "b", label: "B", x: 300, y: 360, type: "normal", lambda: 3 },
  { id: "c", label: "C", x: 500, y: 120, type: "normal", lambda: 6 },
  { id: "d", label: "D", x: 500, y: 360, type: "normal", lambda: 9 },
  { id: "t", label: "T", x: 680, y: 240, type: "sink", lambda: 12 },
];

const INITIAL_EDGES: GraphEdge[] = [
  { id: "e1", from: "s", to: "a", weight: 4, flow: 0 },
  { id: "e2", from: "s", to: "b", weight: 3, flow: 0 },
  { id: "e3", from: "a", to: "c", weight: 2, flow: 0 },
  { id: "e4", from: "a", to: "d", weight: 5, flow: 0 },
  { id: "e5", from: "b", to: "d", weight: 6, flow: 0 },
  { id: "e6", from: "c", to: "t", weight: 3, flow: 0 },
  { id: "e7", from: "d", to: "t", weight: 4, flow: 0 },
  { id: "e8", from: "d", to: "c", weight: 2, flow: 0 },

];

export default function GraphCanvas() {
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [edges] = useState<GraphEdge[]>(INITIAL_EDGES);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const dragOffset = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const getNode = (id: string) =>
    nodes.find((n) => n.id === id);

  const getEdgePath = (edge: GraphEdge) => {
    const from = getNode(edge.from);
    const to = getNode(edge.to);

    if (!from || !to) return "";

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const len = Math.sqrt(dx * dx + dy * dy);

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

      const node = nodes.find((n) => n.id === id);

      if (!node || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();

      dragOffset.current = {
        x: e.clientX - rect.left - node.x,
        y: e.clientY - rect.top - node.y,
      };

      setDragging(id);
    },
    [nodes]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();

      setNodes((prev) =>
        prev.map((n) =>
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
    [dragging]
  );

  const onMouseUp = () => setDragging(null);

  const nodeColor = (node: GraphNode): NodeColors => {
    if (node.type === "source")
      return {
        fill: "#1d4ed8",
        stroke: "#93c5fd",
        text: "#fff",
      };

    if (node.type === "sink")
      return {
        fill: "#7c3aed",
        stroke: "#c4b5fd",
        text: "#fff",
      };

    return {
      fill: "#fff",
      stroke: "#94a3b8",
      text: "#334155",
    };
  };

  const edgeColor = (edge: GraphEdge) => {
    if (edge.flow > 0) return "#3b82f6";
    if (hovered === edge.id) return "#64748b";
    return "#cbd5e1";
  };

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

      {edges.map((edge) => {

        const mid = getMidpoint(edge);

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
              strokeWidth={2}
              markerEnd="url(#arrow)"
            />

            <rect
              x={mid.x - 13}
              y={mid.y - 10}
              width={26}
              height={20}
              rx={6}
              fill="#f8fafc"
              stroke="#e2e8f0"
            />

            <text
              x={mid.x}
              y={mid.y + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight="600"
              fill="#64748b"
            >
              {edge.weight}
            </text>

          </g>
        );
      })}

      {nodes.map((node) => {

        const colors = nodeColor(node);

        const isSel = selected === node.id;

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

            {node.lambda !== undefined && (
              <g transform="translate(0,-38)">

                <rect
                  x={-20}
                  y={-10}
                  width={40}
                  height={18}
                  rx={5}
                  fill="#f1f5f9"
                  stroke="#cbd5e1"
                />

                <text
                  textAnchor="middle"
                  y="3"
                  fontSize={11}
                  fontWeight="600"
                  fill="#334155"
                >
                  λ={node.lambda}
                </text>

              </g>
            )}

            <circle
              r={22}
              fill={colors.fill}
              stroke={isSel ? "#3b82f6" : colors.stroke}
              strokeWidth={2}
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
      })}
    </svg>
  );
}