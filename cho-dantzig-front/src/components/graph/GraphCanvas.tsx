/**
 * GraphCanvas.tsx
 * ───────────────
 * SVG canvas for interactive directed-graph editing.
 *
 * Features
 * ─────────
 * • Drag nodes freely; pan with middle-button or Alt+drag; zoom with wheel.
 * • Add edges in "addEdgeMode": click source → hover shows animated ring on
 *   potential targets → click destination → enter weight → confirm.
 * • Right-click a node or edge to open a context-menu with a Delete option.
 * • Press Delete/Backspace to remove the currently selected node.
 * • Double-click an edge weight badge to edit inline.
 * • Drag the midpoint handle on a hovered edge to adjust its curvature.
 * • Weight badges are offset perpendicularly just enough to stay readable
 *   without drifting far from the arc.
 * • Bidirectional edges are laterally offset so both arcs stay visible.
 *
 * Store contract (useGraphStore)
 * ──────────────────────────────
 *   nodes, edges            – graph data
 *   moveNode(id, x, y)      – update node position
 *   addEdge(edge)           – insert a new edge
 *   updateEdgeWeight(id, w) – change weight on existing edge
 *   removeEdge(id)          – delete an edge by id
 *   removeNode(id)          – delete a node and its incident edges
 *   setCanvasSize(w, h)     – notify store of SVG dimensions
 *   getNodeLambda(id)       – λ value shown above node (optional)
 *   isNodeMarked / isCurrentNode / isSelectedEdge
 *   isNodeInOptimalPath / isEdgeInOptimalPath
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  memo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useGraphStore } from "../../store/graphStore";
import type { GraphEdge, GraphNode, NodeColors } from "../../types/graph";
import { Trash, Trash2 } from "lucide-react";

// ─── Layout & visual constants ────────────────────────────────────────────────

const NODE_RADIUS = 23;

/** Quadratic-bezier curvature: fraction of edge length, capped at MAX_CURVE */
const CURVE_FACTOR = 0.15;
const MAX_CURVE    = 40;

/**
 * Lateral shift (px) applied to each arc of a bidirectional pair so the two
 * arcs don't overlap.
 */
const BIDIRECTIONAL_OFFSET = 14;

/** How far (px) the weight badge is pushed perpendicularly off the arc path.
 *  Small value keeps the label close; 0 would centre it on the arc itself. */
const WEIGHT_PERP_OFFSET = 0;

const ZOOM_MIN  = 0.15;
const ZOOM_MAX  = 4;
const ZOOM_STEP = 1.02;

// Weight badge geometry
const BADGE_H       = 20;
const BADGE_PAD_X   = 8;   // horizontal padding inside the pill
const BADGE_MIN_W   = 24;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  /** When true the canvas is in "add-edge" mode: clicking nodes connects them. */
  addEdgeMode?: boolean;
  onEdgeModeCancel?: () => void;
}

interface PendingEdge {
  fromId: string;
  toId:   string;
  /** SVG-space position of the arc midpoint, used to anchor the weight popup. */
  midX:   number;
  midY:   number;
}

interface XY { x: number; y: number }

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Returns unit vector and length from `from` to `to`. */
function vec(from: XY, to: XY) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len > 0
    ? { dx, dy, len, nx: dx / len, ny: dy / len }
    : { dx: 0, dy: 0, len: 0, nx: 0, ny: 0 };
}

/** Bezier peak offset: proportional to edge length, capped to avoid wild curves. */
function curvature(len: number) {
  return Math.min(MAX_CURVE, len * CURVE_FACTOR);
}

/**
 * Build a quadratic-bezier SVG path between two node centres.
 *
 * @param lateralOffset  Additional perpendicular shift (used for bidirectional
 *                       pairs so the two arcs don't overlap).
 * @param startRadius    How far from `from`'s centre the path starts (default: NODE_RADIUS).
 * @param endRadius      How far from `to`'s centre the path ends.
 */
function buildEdgePath(
  from: XY, to: XY,
  lateralOffset: number = 0,
  startRadius: number  = NODE_RADIUS,
  endRadius: number    = NODE_RADIUS,
): string {
  const { len, nx, ny } = vec(from, to);
  if (len < 2) return "";

  // Trim path start/end to the node circle boundaries
  const x1 = from.x + nx * startRadius;
  const y1 = from.y + ny * startRadius;
  const x2 = to.x   - nx * endRadius;
  const y2 = to.y   - ny * endRadius;

  // Control point: midpoint shifted perpendicular to the edge direction
  const totalOffset = curvature(len) + lateralOffset;
  const mx = (x1 + x2) / 2 - ny * totalOffset;
  const my = (y1 + y2) / 2 + nx * totalOffset;

  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

/**
 * Point on the quadratic bezier at t = 0.5 (i.e., visual midpoint of the arc).
 * This is where the weight badge and the drag handle are anchored.
 */
function bezierMid(from: XY, to: XY, lateralOffset: number = 0): XY {
  const { len, ny, nx } = vec(from, to);
  if (len === 0) return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const totalOffset = curvature(len) + lateralOffset;
  return {
    x: (from.x + to.x) / 2 - ny * totalOffset,
    y: (from.y + to.y) / 2 + nx * totalOffset,
  };
}

/**
 * Position for the weight badge: the arc midpoint shifted a small amount
 * further along the perpendicular so the badge sits just beside the line,
 * not on top of it.
 *
 * Deliberately kept small (WEIGHT_PERP_OFFSET) — enough to avoid overlap
 * without pushing the label far away from its arc.
 */
function weightBadgePos(from: XY, to: XY, lateralOffset: number, extraOffset: number): XY {
  const mid = bezierMid(from, to, lateralOffset + extraOffset);
  const { ny, nx, len } = vec(from, to);
  if (len === 0) return mid;
  return {
    x: mid.x - ny * WEIGHT_PERP_OFFSET,
    y: mid.y + nx * WEIGHT_PERP_OFFSET,
  };
}

/** Cubic self-loop path that starts and ends at the same node. */
function buildSelfLoopPath(node: XY): string {
  const r = NODE_RADIUS;
  const x = node.x + r * 0.7;
  const y = node.y - r * 0.7;
  return `M ${node.x + r * 0.5} ${node.y - r * 0.5}
          C ${x + 30} ${y - 40}, ${x + 50} ${y + 20}, ${node.x + r} ${node.y}`;
}

/** Approximate visual midpoint for a self-loop (for badge placement). */
function selfLoopMid(node: XY): XY {
  return { x: node.x + NODE_RADIUS + 30, y: node.y - NODE_RADIUS - 20 };
}

/** Estimate rendered width of a monospace string for dynamic badge sizing. */
function monoTextWidth(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.62;
}

// ─── Inline SVG icon components ───────────────────────────────────────────────
// Using pure SVG paths avoids any icon-library dependency and keeps the icons
// crisp at any scale.

/** Trash / bin icon (14 × 14 viewport). */
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: "block" }}>
    <path
      d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 3.5l.5 7h3l.5-7"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

// ─── Reusable sub-components ──────────────────────────────────────────────────

/** SVG <marker> for arrowheads — one per colour variant. */
interface ArrowMarkerProps { id: string; fill: string }
const ArrowMarker = memo(({ id, fill }: ArrowMarkerProps) => (
  <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
    <path d="M0,0 L0,6 L8,3 z" fill={fill} />
  </marker>
));

// ── Weight-entry popup ───────────────────────────────────────────────────────
interface WeightPopupProps {
  midX: number; midY: number;
  value: string;
  zoom: number; pan: XY;
  onConfirm: () => void;
  onCancel:  () => void;
  onChange:  (v: string) => void;
  inputRef:  React.RefObject<HTMLInputElement>;
}

/**
 * Floating popup that appears over the canvas (outside the zoom transform) to
 * collect the weight for a newly drawn edge.  Positioned in screen space so it
 * doesn't scale with zoom.
 */
const WeightPopup = memo(({
  midX, midY, value, zoom, pan, onConfirm, onCancel, onChange, inputRef,
}: WeightPopupProps) => (
  <foreignObject
    x={midX * zoom + pan.x - 82}
    y={midY * zoom + pan.y - 52}
    width={164} height={100}
    style={{ overflow: "visible" }}
  >
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #ddd6fe",
        borderRadius: 14,
        boxShadow: "0 6px 30px rgba(124,58,237,0.16), 0 1px 4px rgba(0,0,0,0.07)",
        padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 8,
        userSelect: "none",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, color: "#8b5cf6",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        Poids de l'arc
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="number" min={0} step="any" value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { e.preventDefault(); onConfirm(); }
            if (e.key === "Escape") onCancel();
          }}
          aria-label="Poids de l'arc"
          style={{
            width: 62, padding: "5px 8px", fontSize: 13, fontWeight: 600,
            border: "1px solid #ede9fe", borderRadius: 8, outline: "none",
            color: "#5b21b6", background: "#faf5ff",
            fontFamily: "ui-monospace, monospace",
          }}
        />
        <button
          onClick={onConfirm} aria-label="Confirmer"
          style={{
            flex: 1, background: "#7c3aed", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 12,
            fontWeight: 700, cursor: "pointer", padding: "5px 0",
          }}
        >OK</button>
        <button
          onClick={onCancel} aria-label="Annuler"
          style={{
            width: 28, height: 28, background: "#f1f5f9", color: "#94a3b8",
            border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>
      </div>
    </div>
  </foreignObject>
));

// ── Context menu ─────────────────────────────────────────────────────────────
interface ContextMenuProps {
  /** Position in SVG graph-space (inside the zoom/pan transform). */
  x: number; y: number;
  /** Header label shown at the top of the menu ("Sommet" / "Arc"). */
  label: string;
  onDelete: () => void;
  onClose:  () => void;
}

/**
 * Minimal right-click context menu rendered inside the SVG transform group.
 * Offers a single "Supprimer" action with a bin icon.
 */
const ContextMenu = memo(({ x, y, label, onDelete, onClose }: ContextMenuProps) => (
  <foreignObject x={x} y={y} width={164} height={60} style={{ overflow: "visible" }}>
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
        padding: "4px 0",
        minWidth: 156,
        userSelect: "none",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div style={{
        padding: "4px 12px 5px",
        fontSize: 10, color: "#94a3b8", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.07em",
        borderBottom: "1px solid #f1f5f9",
      }}>
        {label}
      </div>

      {/* Delete action */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", background: "none", border: "none",
          padding: "7px 12px", cursor: "pointer",
          fontSize: 13, color: "#ef4444", fontWeight: 500, textAlign: "left",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Trash2 />
        Supprimer
      </button>
    </div>
  </foreignObject>
));

// ─── Main component ───────────────────────────────────────────────────────────

export default function GraphCanvas({ addEdgeMode = false }: GraphCanvasProps) {
  const {
    nodes, edges,
    setCanvasSize,
    getNodeLambda,
    isNodeMarked, isCurrentNode, isSelectedEdge,
    isNodeInOptimalPath, isEdgeInOptimalPath,
    moveNode, addEdge,
    updateEdgeWeight,
    removeEdge,
    removeNode,
  } = useGraphStore();

  // ── Node interaction state ─────────────────────────────────────────────────
  /** Id of the node currently being dragged. */
  const [dragging,  setDragging]  = useState<string | null>(null);
  /** Id of the node that is "selected" (shown with a dashed ring). */
  const [selected,  setSelected]  = useState<string | null>(null);
  /** Id of the edge the mouse is currently hovering over. */
  const [hovered,   setHovered]   = useState<string | null>(null);
  /**
   * In addEdgeMode: the node the user clicked first (the source).
   * An animated ring is shown around it until a destination is chosen.
   */
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  /**
   * In addEdgeMode: the node the mouse is currently hovering while a source
   * has already been selected.  A secondary animated ring (teal) is shown to
   * indicate this would become the destination.
   */
  const [edgeHoverTarget, setEdgeHoverTarget] = useState<string | null>(null);
  /** Current SVG-space cursor position, used to draw the preview dashed arc. */
  const [cursorPos,  setCursorPos]  = useState<XY | null>(null);
  /** Edge that has been drawn but not yet confirmed (waiting for weight input). */
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  /** Controlled value for the weight input inside WeightPopup. */
  const [weightInput, setWeightInput] = useState<string>("");

  // ── Inline edge-weight editing ─────────────────────────────────────────────
  /** Id of the edge whose weight is being edited inline. */
  const [editingEdge,      setEditingEdge]      = useState<string | null>(null);
  const [editingEdgeValue, setEditingEdgeValue] = useState<string>("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Edge-curvature dragging ────────────────────────────────────────────────
  /** Id of the edge whose midpoint handle is being dragged. */
  const [draggingEdge, setDraggingEdge] = useState<string | null>(null);
  /**
   * Per-edge extra perpendicular offset accumulated by dragging the midpoint
   * handle.  Keyed by edge id.
   */
  const [edgeOffsets, setEdgeOffsets] = useState<Record<string, number>>({});

  // ── Context menu ───────────────────────────────────────────────────────────
  interface CtxMenu { x: number; y: number; type: "node" | "edge"; id: string }
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // ── Zoom / pan ─────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState<XY>({ x: 0, y: 0 });
  const isPanning   = useRef(false);
  const panStart    = useRef<XY>({ x: 0, y: 0 });
  const panOrigin   = useRef<XY>({ x: 0, y: 0 });

  // ── Misc refs ──────────────────────────────────────────────────────────────
  const svgRef        = useRef<SVGSVGElement>(null);
  const dragOffset    = useRef<XY>({ x: 0, y: 0 });
  const weightInputRef = useRef<HTMLInputElement>(null);
  /** Set to true as soon as the pointer moves during a drag; prevents click. */
  const didDrag = useRef(false);

  // ── Derived / memoised data ────────────────────────────────────────────────

  /** Normalised node map with safe fallback coordinates. */
  const nodeMap = useMemo<Map<string, GraphNode>>(
    () => new Map((nodes ?? []).map((n) => [n.id, {
      ...n,
      x: Number.isFinite(n.x) ? n.x : 400,
      y: Number.isFinite(n.y) ? n.y : 250,
    }])),
    [nodes]
  );

  const safeNodes = useMemo(() => Array.from(nodeMap.values()), [nodeMap]);
  const safeEdges = useMemo(() => edges ?? [], [edges]);

  /**
   * Set of edge keys (e.g. "A->B") that have a matching reverse edge.
   * Used to decide when to apply BIDIRECTIONAL_OFFSET.
   */
  const bidirectionalSet = useMemo<Set<string>>(() => {
    const keys = new Set<string>();
    safeEdges.forEach((e) => keys.add(`${e.from}->${e.to}`));
    const bidi = new Set<string>();
    safeEdges.forEach((e) => {
      if (keys.has(`${e.to}->${e.from}`)) {
        bidi.add(`${e.from}->${e.to}`);
        bidi.add(`${e.to}->${e.from}`);
      }
    });
    return bidi;
  }, [safeEdges]);

  const getNode = useCallback((id: string) => nodeMap.get(id), [nodeMap]);

  const getLateralOffset = useCallback(
    (edge: GraphEdge): number =>
      bidirectionalSet.has(`${edge.from}->${edge.to}`) ? BIDIRECTIONAL_OFFSET : 0,
    [bidirectionalSet]
  );

  /** Full SVG path string for an edge (or self-loop). */
  const getEdgePath = useCallback((edge: GraphEdge): string => {
    const from = getNode(edge.from);
    const to   = getNode(edge.to);
    if (!from || !to) return "";
    if (from.id === to.id) return buildSelfLoopPath(from);
    const extra = edgeOffsets[edge.id] ?? 0;
    return buildEdgePath(from, to, getLateralOffset(edge) + extra);
  }, [getNode, getLateralOffset, edgeOffsets]);

  /** Geometric midpoint of an edge arc (for the drag handle). */
  const getEdgeMid = useCallback((edge: GraphEdge): XY => {
    const from = getNode(edge.from);
    const to   = getNode(edge.to);
    if (!from || !to) return { x: 0, y: 0 };
    if (from.id === to.id) return selfLoopMid(from);
    const extra = edgeOffsets[edge.id] ?? 0;
    return bezierMid(from, to, getLateralOffset(edge) + extra);
  }, [getNode, getLateralOffset, edgeOffsets]);

  /**
   * Position for the weight badge, offset just slightly off the arc.
   * See `weightBadgePos` for the rationale behind WEIGHT_PERP_OFFSET.
   */
  const getWeightBadgePos = useCallback((edge: GraphEdge): XY => {
    const from = getNode(edge.from);
    const to   = getNode(edge.to);
    if (!from || !to) return { x: 0, y: 0 };
    if (from.id === to.id) return selfLoopMid(from);
    const extra = edgeOffsets[edge.id] ?? 0;
    return weightBadgePos(from, to, getLateralOffset(edge), extra);
  }, [getNode, getLateralOffset, edgeOffsets]);

  // ── Coordinate conversion ──────────────────────────────────────────────────

  /** Client (screen) → SVG graph-space, accounting for current zoom/pan. */
  const getSvgCoords = useCallback((clientX: number, clientY: number): XY => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ── Effect: reset edge-mode state when mode is exited ─────────────────────
  useEffect(() => {
    if (!addEdgeMode) {
      setEdgeSource(null);
      setEdgeHoverTarget(null);
      setCursorPos(null);
      setPendingEdge(null);
      setWeightInput("");
    }
  }, [addEdgeMode]);

  // ── Effect: auto-focus the weight input when the popup appears ────────────
  useEffect(() => {
    if (pendingEdge && weightInputRef.current) {
      const t = setTimeout(() => weightInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [pendingEdge]);

  // ── Effect: auto-select text in the inline edit input ─────────────────────
  useEffect(() => {
    if (editingEdge && editInputRef.current) {
      editInputRef.current.select();
    }
  }, [editingEdge]);

  // ── Effect: close context menu on any outside pointer-down ────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [ctxMenu]);

  // ── Zoom helpers ───────────────────────────────────────────────────────────

  /**
   * Apply a new zoom level, optionally pivoting around a screen-space point
   * (clientX / clientY) so the content under the cursor stays fixed.
   */
  const applyZoom = useCallback((nextZoom: number, pivotX?: number, pivotY?: number) => {
    setZoom((prev) => {
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
      if (pivotX !== undefined && pivotY !== undefined && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const px = pivotX - rect.left;
        const py = pivotY - rect.top;
        // Adjust pan so the pivot point is invariant
        setPan((p) => ({
          x: px - (px - p.x) * (z / prev),
          y: py - (py - p.y) * (z / prev),
        }));
      }
      return z;
    });
  }, []);

  const zoomIn  = useCallback(() => applyZoom(zoom * ZOOM_STEP), [applyZoom, zoom]);
  const zoomOut = useCallback(() => applyZoom(zoom / ZOOM_STEP), [applyZoom, zoom]);

  /** Fit all nodes inside the viewport with padding. */
  const fitView = useCallback(() => {
    if (!svgRef.current || safeNodes.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pad  = 110;
    const xs   = safeNodes.map((n) => n.x);
    const ys   = safeNodes.map((n) => n.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
      Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))
    ));
    setZoom(nextZoom);
    setPan({
      x: rect.width  / 2 - ((minX + maxX) / 2) * nextZoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * nextZoom,
    });
  }, [safeNodes]);

  // ── SVG pointer events ─────────────────────────────────────────────────────

  /** Wheel: zoom pivoting on cursor position (Figma behaviour). */
  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    applyZoom(zoom * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP), e.clientX, e.clientY);
  }, [applyZoom, zoom]);

  /** Middle-button or Alt+left-drag starts panning. */
  const onPointerDownSvg = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanning.current  = true;
      panStart.current   = { x: e.clientX, y: e.clientY };
      panOrigin.current  = { ...pan };
      (e.target as SVGSVGElement).setPointerCapture(e.pointerId);
    }
  }, [pan]);

  const onPointerMoveSvg = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    // ── Panning ──
    if (isPanning.current) {
      setPan({
        x: panOrigin.current.x + (e.clientX - panStart.current.x),
        y: panOrigin.current.y + (e.clientY - panStart.current.y),
      });
      return;
    }

    // ── Edge-curvature dragging ──
    if (draggingEdge) {
      const svgC = getSvgCoords(e.clientX, e.clientY);
      const edge = safeEdges.find((ed) => ed.id === draggingEdge);
      if (edge) {
        const from = getNode(edge.from);
        const to   = getNode(edge.to);
        if (from && to && from.id !== to.id) {
          const { nx, ny } = vec(from, to);
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          // Project cursor displacement onto the perpendicular axis
          const proj = (svgC.x - midX) * (-ny) + (svgC.y - midY) * nx;
          setEdgeOffsets((prev) => ({ ...prev, [draggingEdge]: proj - getLateralOffset(edge) }));
        }
      }
      return;
    }

    // ── Node dragging ──
    if (dragging) {
      didDrag.current = true;
      const { x, y } = getSvgCoords(e.clientX, e.clientY);
      moveNode(dragging, x - dragOffset.current.x, y - dragOffset.current.y);
      return;
    }

    // ── Preview arc while selecting destination ──
    if (addEdgeMode && edgeSource && !pendingEdge) {
      setCursorPos(getSvgCoords(e.clientX, e.clientY));
    }
  }, [
    isPanning, draggingEdge, dragging, addEdgeMode, edgeSource, pendingEdge,
    getSvgCoords, safeEdges, getNode, getLateralOffset, moveNode,
  ]);

  const onPointerUpSvg = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning.current) {
      isPanning.current = false;
      (e.target as SVGSVGElement).releasePointerCapture?.(e.pointerId);
    }
    setDragging(null);
    setDraggingEdge(null);
  }, []);

  // ── Node events ────────────────────────────────────────────────────────────

  const onPointerDownNode = useCallback(
    (e: ReactPointerEvent<SVGGElement>, id: string) => {
      if (addEdgeMode) return; // clicks are handled by onClickNode in this mode
      e.stopPropagation();
      setSelected(id);
      const node = nodeMap.get(id);
      if (!node || !svgRef.current) return;
      const { x, y } = getSvgCoords(e.clientX, e.clientY);
      dragOffset.current = { x: x - node.x, y: y - node.y };
      didDrag.current    = false;
      setDragging(id);
    },
    [addEdgeMode, nodeMap, getSvgCoords]
  );

  /**
   * In addEdgeMode: first click picks the source, second click (on a different
   * node) picks the destination and opens the weight popup.
   * Clicking the same node twice creates a self-loop.
   */
  const onClickNode = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (!addEdgeMode) return;
      e.stopPropagation();
      if (pendingEdge) return; // already waiting for weight input

      if (!edgeSource) {
        // Step 1: select source
        setEdgeSource(id);
      } else if (edgeSource === id) {
        // Step 2a: self-loop
        const node = nodeMap.get(id)!;
        setPendingEdge({
          fromId: id, toId: id,
          midX: node.x + NODE_RADIUS + 30,
          midY: node.y - NODE_RADIUS - 20,
        });
        setWeightInput("");
        setEdgeSource(null);
        setEdgeHoverTarget(null);
      } else {
        // Step 2b: normal edge
        const from = nodeMap.get(edgeSource)!;
        const to   = nodeMap.get(id)!;
        const lat  = bidirectionalSet.has(`${edgeSource}->${id}`) ? BIDIRECTIONAL_OFFSET : 0;
        const mid  = bezierMid(from, to, lat);
        setPendingEdge({ fromId: edgeSource, toId: id, midX: mid.x, midY: mid.y });
        setWeightInput("");
        setEdgeSource(null);
        setEdgeHoverTarget(null);
        setCursorPos(null);
      }
    },
    [addEdgeMode, pendingEdge, edgeSource, nodeMap, bidirectionalSet]
  );

  /** Right-click a node → context menu. */
  const onContextMenuNode = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (addEdgeMode) return;
      e.preventDefault();
      e.stopPropagation();
      const node = nodeMap.get(id);
      if (!node) return;
      // Position the menu near the node's right edge, in SVG space
      setCtxMenu({ x: node.x + NODE_RADIUS + 6, y: node.y - 14, type: "node", id });
    },
    [addEdgeMode, nodeMap]
  );

  /** Right-click an edge → context menu. */
  const onContextMenuEdge = useCallback(
    (e: React.MouseEvent, edge: GraphEdge) => {
      if (addEdgeMode) return;
      e.preventDefault();
      e.stopPropagation();
      const mid = getEdgeMid(edge);
      setCtxMenu({ x: mid.x + 8, y: mid.y - 8, type: "edge", id: edge.id });
    },
    [addEdgeMode, getEdgeMid]
  );

  // ── Edge confirmation / cancellation ──────────────────────────────────────

  const confirmEdge = useCallback(() => {
    if (!pendingEdge) return;
    const w = parseFloat(weightInput);
    if (!Number.isFinite(w)) return;
    addEdge?.({
      id:     `e_${pendingEdge.fromId}_${pendingEdge.toId}_${Date.now()}`,
      from:   pendingEdge.fromId,
      to:     pendingEdge.toId,
      weight: w,
      flow:   0,
    });
    setPendingEdge(null);
    setWeightInput("");
  }, [pendingEdge, weightInput, addEdge]);

  const cancelPendingEdge = useCallback(() => {
    setPendingEdge(null);
    setEdgeSource(null);
    setWeightInput("");
  }, []);

  // ── Inline weight editing ──────────────────────────────────────────────────

  const startEditEdge = useCallback((edge: GraphEdge) => {
    if (addEdgeMode) return;
    setEditingEdge(edge.id);
    setEditingEdgeValue(String(edge.weight));
  }, [addEdgeMode]);

  const confirmEditEdge = useCallback(() => {
    if (!editingEdge) return;
    const w = parseFloat(editingEdgeValue);
    if (Number.isFinite(w)) updateEdgeWeight?.(editingEdge, w);
    setEditingEdge(null);
  }, [editingEdge, editingEdgeValue, updateEdgeWeight]);

  // ── Edge-curvature handle ──────────────────────────────────────────────────

  const onPointerDownEdgeHandle = useCallback(
    (e: React.PointerEvent, edgeId: string) => {
      if (addEdgeMode) return;
      e.stopPropagation();
      setDraggingEdge(edgeId);
    },
    [addEdgeMode]
  );

  // ── SVG background click ───────────────────────────────────────────────────

  const onClickSvg = useCallback((e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    setSelected(null);
    setEditingEdge(null);
    setCtxMenu(null);
    if (addEdgeMode) {
      if (pendingEdge) cancelPendingEdge();
      else { setEdgeSource(null); setEdgeHoverTarget(null); setCursorPos(null); }
    }
  }, [addEdgeMode, pendingEdge, cancelPendingEdge]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if      (pendingEdge)  cancelPendingEdge();
        else if (editingEdge)  setEditingEdge(null);
        else                   setCtxMenu(null);
      }
      // Delete/Backspace when a node is selected (and not inside an input)
      if (
        (e.key === "Delete" || e.key === "Backspace")
        && selected
        && !editingEdge
        && !(e.target as HTMLElement).closest("input, textarea")
      ) {
        removeNode?.(selected);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingEdge, editingEdge, selected, cancelPendingEdge, removeNode]);

  // ── Toolbar button events (dispatched via window) ─────────────────────────
  useEffect(() => {
    const handlers: [string, () => void][] = [
      ["graph-zoom-in",  zoomIn],
      ["graph-zoom-out", zoomOut],
      ["graph-fit-view", fitView],
    ];
    handlers.forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return ()        => handlers.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
  }, [zoomIn, zoomOut, fitView]);

  // ── Canvas size tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const update = () => {
      const rect = svgRef.current!.getBoundingClientRect();
      setCanvasSize(rect.width, rect.height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, [setCanvasSize]);

  // ── Preview path (dashed arc following cursor) ────────────────────────────
  const previewPath = useMemo(() => {
    if (!addEdgeMode || !edgeSource || pendingEdge || !cursorPos) return null;
    const from = nodeMap.get(edgeSource);
    if (!from) return null;
    return buildEdgePath(from, cursorPos, 0, NODE_RADIUS, 0);
  }, [addEdgeMode, edgeSource, pendingEdge, cursorPos, nodeMap]);

  // ── Styling helpers ────────────────────────────────────────────────────────

  const nodeColors = useCallback((node: GraphNode): NodeColors => {
    if (addEdgeMode) {
      if (edgeSource === node.id)     return { fill: "#2563eb", stroke: "#60a5fa", text: "#fff" };
      if (pendingEdge?.toId === node.id) return { fill: "#7c3aed", stroke: "#a78bfa", text: "#fff" };
      return { fill: "#f8fafc", stroke: "#cbd5e1", text: "#475569" };
    }
    if (isNodeInOptimalPath(node.id)) return { fill: "#2d6ef8", stroke: "#2d5ef8", text: "#fff" };
    if (isCurrentNode(node.id))        return { fill: "#f59e0b", stroke: "#fcd34d", text: "#fff" };
    if (isNodeMarked(node.id))         return { fill: "#fef08a", stroke: "#eab308", text: "#713f12" };
    return { fill: "#ffffff", stroke: "#e2e8f0", text: "#334155" };
  }, [addEdgeMode, edgeSource, pendingEdge, isNodeInOptimalPath, isCurrentNode, isNodeMarked]);

  const edgeStrokeColor = useCallback((edge: GraphEdge): string => {
    if (isEdgeInOptimalPath(edge.from, edge.to)) return "#2d6ef8";
    if (isSelectedEdge(edge.from, edge.to))      return "#f59e0b";
    if (hovered === edge.id)                      return "#64748b";
    return "#c1cfe0";
  }, [isEdgeInOptimalPath, isSelectedEdge, hovered]);

  const edgeMarker = useCallback((edge: GraphEdge): string => {
    if (isEdgeInOptimalPath(edge.from, edge.to)) return "url(#arrow-optimal)";
    if (isSelectedEdge(edge.from, edge.to))      return "url(#arrow-selected)";
    if (hovered === edge.id)                      return "url(#arrow-hover)";
    return "url(#arrow)";
  }, [isEdgeInOptimalPath, isSelectedEdge, hovered]);

  const svgCursor = isPanning.current
    ? "grabbing"
    : addEdgeMode
    ? (edgeSource ? "crosshair" : "cell")
    : (dragging ? "grabbing" : "default");

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="Graphe interactif"
      className="w-full h-full select-none"
      style={{ cursor: svgCursor, outline: "none" }}
      onPointerDown={onPointerDownSvg}
      onPointerMove={onPointerMoveSvg}
      onPointerUp={onPointerUpSvg}
      onClick={onClickSvg}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Defs: arrowhead markers & filters ─────────────────────────────── */}
      <defs>
        <ArrowMarker id="arrow"          fill="#cbd5e1" />
        <ArrowMarker id="arrow-selected" fill="#f59e0b" />
        <ArrowMarker id="arrow-optimal"  fill="#1d4ed8" />
        <ArrowMarker id="arrow-preview"  fill="#3b82f6" />
        <ArrowMarker id="arrow-pending"  fill="#7c3aed" />
        <ArrowMarker id="arrow-hover"    fill="#64748b" />

        {/* Subtle drop-shadow for normal nodes */}
        <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.10" />
        </filter>
        {/* Glow filters for highlighted states */}
        <filter id="glow-blue"   x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#3b82f6" floodOpacity="0.45" />
        </filter>
        <filter id="glow-teal"   x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#0d9488" floodOpacity="0.45" />
        </filter>
        <filter id="glow-purple" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#7c3aed" floodOpacity="0.45" />
        </filter>
        <filter id="glow-amber"  x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f59e0b" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* ── Zoom / pan transform group ─────────────────────────────────────── */}
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>

        {/* ════════════════════════════════════════════════════════════════════
            EDGES
            Rendered before nodes so they appear behind node circles.
            ════════════════════════════════════════════════════════════════════ */}
        {safeEdges.map((edge) => {
          const badgePos    = getWeightBadgePos(edge);
          const isOptimal   = isEdgeInOptimalPath(edge.from, edge.to);
          const isSel       = isSelectedEdge(edge.from, edge.to);
          const isHov       = hovered === edge.id;
          const isDragThis  = draggingEdge === edge.id;
          const color       = edgeStrokeColor(edge);
          const strokeW     = isOptimal ? 2.8 : isSel ? 2.4 : (isHov || isDragThis) ? 2 : 1.7;
          const path        = getEdgePath(edge);
          const isEditing   = editingEdge === edge.id;

          const weightStr = String(edge.weight);
          const badgeW    = Math.max(BADGE_MIN_W, monoTextWidth(weightStr) + BADGE_PAD_X * 2);

          return (
            <g
              key={edge.id}
              onMouseEnter={() => setHovered(edge.id)}
              onMouseLeave={() => setHovered(null)}
              onContextMenu={(e) => onContextMenuEdge(e, edge)}
            >
              {/* Invisible wide hit zone so edges are easy to hover/right-click */}
              <path
                d={path} fill="none" stroke="transparent" strokeWidth={18}
                style={{ cursor: "pointer" }}
              />

              {/* Visible arc */}
              <path
                d={path} fill="none"
                stroke={color} strokeWidth={strokeW} strokeLinecap="round"
                markerEnd={edgeMarker(edge)}
                style={{ transition: "stroke 0.12s, stroke-width 0.12s", pointerEvents: "none" }}
              />

              {/* Weight badge — inline editor when double-clicked */}
              {isEditing ? (
                <foreignObject
                  x={badgePos.x - 32} y={badgePos.y - 16}
                  width={64} height={32}
                  style={{ overflow: "visible" }}
                >
                  <input
                    ref={editInputRef}
                    type="number"
                    value={editingEdgeValue}
                    onChange={(e) => setEditingEdgeValue(e.target.value)}
                    onBlur={confirmEditEdge}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")  { e.preventDefault(); confirmEditEdge(); }
                      if (e.key === "Escape") setEditingEdge(null);
                    }}
                    style={{
                      width: 60, textAlign: "center",
                      fontSize: 12, fontWeight: 700,
                      border: "1.5px solid #7c3aed", borderRadius: 8,
                      padding: "2px 4px",
                      fontFamily: "ui-monospace, monospace",
                      color: "#5b21b6", background: "#faf5ff", outline: "none",
                    }}
                  />
                </foreignObject>
              ) : (
                // Static badge — single-click to edit
                <g
                  style={{ cursor: addEdgeMode ? "default" : "text" }}
                  onClick={(e) => { e.stopPropagation(); startEditEdge(edge); }}
                >
                  <rect
                    x={badgePos.x - badgeW / 2} y={badgePos.y - BADGE_H / 2}
                    width={badgeW} height={BADGE_H} rx={6}
                    fill={isOptimal ? "#eff6ff" : isSel ? "#fffbeb" : isHov ? "#f1f5f9" : "#f8fafc"}
                    stroke={isOptimal ? "#93c5fd" : isSel ? "#fcd34d" : isHov ? "#cbd5e1" : "#e2e8f0"}
                    strokeWidth={isOptimal || isSel ? 1.2 : 0.8}
                    style={{ transition: "fill 0.12s" }}
                  />
                  <text
                    x={badgePos.x} y={badgePos.y + 4}
                    textAnchor="middle"
                    fontSize={11} fontWeight={700}
                    fontFamily="ui-monospace, monospace"
                    fill={isOptimal ? "#1d4ed8" : isSel ? "#b45309" : isHov ? "#475569" : "#94a3b8"}
                    style={{ transition: "fill 0.12s", pointerEvents: "none" }}
                  >
                    {edge.weight}
                  </text>
                </g>
              )}

              {/* Midpoint drag handle — visible only when hovered or dragging */}
              {!addEdgeMode && (isHov || isDragThis) && (() => {
                const mid = getEdgeMid(edge);
                return (
                  <circle
                    cx={mid.x} cy={mid.y} r={5}
                    fill={isDragThis ? "#7c3aed" : "#94a3b8"}
                    stroke="#fff" strokeWidth={1.5}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => onPointerDownEdgeHandle(e, edge.id)}
                    onMouseEnter={(e) => e.stopPropagation()}
                  />
                );
              })()}
            </g>
          );
        })}

        {/* ── Preview arc (dashed line tracking the cursor while selecting dest) */}
        {previewPath && (
          <path
            d={previewPath} fill="none"
            stroke="#3b82f6" strokeWidth={1.8} strokeDasharray="7 4"
            markerEnd="url(#arrow-preview)" opacity={0.7}
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* ── Pending arc (dashed, fixed; shown while the weight popup is open) */}
        {pendingEdge && (() => {
          const from = getNode(pendingEdge.fromId);
          const to   = getNode(pendingEdge.toId);
          if (!from || !to) return null;
          const path = from.id === to.id
            ? buildSelfLoopPath(from)
            : buildEdgePath(from, to, BIDIRECTIONAL_OFFSET);
          return (
            <path
              d={path} fill="none"
              stroke="#7c3aed" strokeWidth={2} strokeDasharray="7 3"
              markerEnd="url(#arrow-pending)" opacity={0.85}
              style={{ pointerEvents: "none" }}
            />
          );
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            NODES
            ════════════════════════════════════════════════════════════════════ */}
        {safeNodes.map((node) => {
          const colors    = nodeColors(node);
          const lambdaVal = getNodeLambda?.(node.id) ?? null;
          const isSel     = selected === node.id;
          const isMarked  = isNodeMarked(node.id);
          const isCurrent = isCurrentNode(node.id);
          const isOptimal = isNodeInOptimalPath(node.id);

          // In addEdgeMode: source node (clicked) and hover-target node
          const isEdgeSrc = addEdgeMode && edgeSource === node.id;
          const isEdgeTgt = addEdgeMode && pendingEdge?.toId === node.id;
          /**
           * Hover target: node under cursor when a source is selected.
           * Shows a teal animated ring — different from the blue source ring —
           * to signal "this would be the destination".
           */
          const isEdgeHovTarget = addEdgeMode && !!edgeSource && !pendingEdge
            && edgeHoverTarget === node.id && edgeHoverTarget !== edgeSource;

          const filter = isEdgeSrc       ? "url(#glow-blue)"
            : isEdgeTgt                  ? "url(#glow-purple)"
            : isEdgeHovTarget            ? "url(#glow-teal)"
            : isCurrent                  ? "url(#glow-amber)"
            : "url(#node-shadow)";

          const strokeColor = isEdgeSrc        ? "#3b82f6"
            : isEdgeTgt                         ? "#7c3aed"
            : isEdgeHovTarget                   ? "#0d9488"
            : (!addEdgeMode && isSel)           ? "#3b82f6"
            : isCurrent                         ? "#fcd34d"
            : isOptimal                         ? "#60a5fa"
            : "#cbd5e1";

          const strokeWidth = (isEdgeSrc || isEdgeTgt || isEdgeHovTarget || isCurrent || isOptimal)
            ? 2.5
            : (!addEdgeMode && isSel) ? 2
            : 1.5;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              role="button"
              aria-label={`Nœud ${node.label}`}
              tabIndex={0}
              onPointerDown={(e) => onPointerDownNode(e, node.id)}
              onPointerEnter={() => addEdgeMode && edgeSource && !pendingEdge && setEdgeHoverTarget(node.id)}
              onPointerLeave={() => setEdgeHoverTarget(null)}
              onClick={(e) => onClickNode(e, node.id)}
              onContextMenu={(e) => onContextMenuNode(e, node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  onClickNode(e as unknown as React.MouseEvent, node.id);
              }}
              style={{
                cursor: addEdgeMode ? "pointer" : dragging === node.id ? "grabbing" : "grab",
                outline: "none", // native focus-ring suppressed; we draw our own
              }}
              filter={filter}
            >
              {/* ── Source animated ring (blue, clockwise) ── */}
              {isEdgeSrc && (
                <circle
                  r={32} fill="none"
                  stroke="#3b82f6" strokeWidth={1.5} opacity={0.35} strokeDasharray="5 3"
                >
                  <animateTransform
                    attributeName="transform" type="rotate"
                    from="0" to="360" dur="6s" repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* ── Hover-target animated ring (teal, counter-clockwise, slightly larger) ── */}
              {isEdgeHovTarget && (
                <circle
                  r={34} fill="none"
                  stroke="#0d9488" strokeWidth={1.5} opacity={0.30} strokeDasharray="4 4"
                >
                  <animateTransform
                    attributeName="transform" type="rotate"
                    from="360" to="0" dur="5s" repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* ── Selection ring (static dashes, only outside addEdgeMode) ── */}
              {!addEdgeMode && isSel && dragging !== node.id && (
                <circle
                  r={NODE_RADIUS + 5} fill="none"
                  stroke="#3b82f6" strokeWidth={1.5}
                  strokeDasharray="4 3" opacity={0.5}
                />
              )}

              {/* ── λ value badge (shown above the node during algorithm runs) ── */}
              {lambdaVal !== null && lambdaVal !== undefined && (
                <g transform="translate(0,-44)">
                  <rect
                    x={-30} y={-12} width={60} height={26} rx={9}
                    fill  ={isCurrent ? "#fdf0c7" : isMarked ? "#fdf0e8" : "#f5f0ff"}
                    stroke={isCurrent ? "#fcd34d" : isMarked ? "#fde047" : "#e2e8f0"}
                    strokeWidth={0.9}
                  />
                    <text
                      textAnchor="middle"
                      y={5}
                      fontSize={12}
                      fontWeight={700}
                      fontFamily="ui-serif, Georgia, serif"
                      fill={isCurrent ? "#92400e" : isMarked ? "#713f12" : "#475569"}
                    >
                      λ
                      <tspan
                        dy="3"
                        fontSize="8"
                      >
                        {node.label}
                      </tspan>
                      <tspan dy="-3" fontSize="12">
                        {" = "}
                        {lambdaVal}
                      </tspan>
                    </text>
                </g>
              )}

              {/* ── Main circle ── */}
              <circle
                r={NODE_RADIUS}
                fill={colors.fill} stroke={strokeColor} strokeWidth={strokeWidth}
                style={{ transition: "fill 0.15s, stroke 0.15s" }}
              />

              {/* ── Node label ── */}
              <text
                textAnchor="middle" dominantBaseline="central"
                fontSize={13} fontWeight={700} fill={colors.text}
                style={{ pointerEvents: "none", letterSpacing: "0.01em" }}
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* ── Context menu (inside transform group so it follows zoom/pan) ── */}
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x} y={ctxMenu.y}
            label={ctxMenu.type === "node" ? "Sommet" : "Arc"}
            onDelete={() => {
              if (ctxMenu.type === "node") removeNode?.(ctxMenu.id);
              else                         removeEdge?.(ctxMenu.id);
            }}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </g>

      {/* ── Weight popup (outside transform — fixed screen-space position) ── */}
      {pendingEdge && (
        <WeightPopup
          midX={pendingEdge.midX} midY={pendingEdge.midY}
          value={weightInput}
          zoom={zoom} pan={pan}
          onConfirm={confirmEdge}
          onCancel={cancelPendingEdge}
          onChange={setWeightInput}
          inputRef={weightInputRef}
        />
      )}
    </svg>
  );
}
