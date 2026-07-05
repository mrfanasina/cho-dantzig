/**
 * GraphCanvas.tsx
 * ───────────────
 * Canevas SVG pour l'édition interactive d'un graphe orienté.
 *
 * Fonctionnalités
 * ─────────
 * • Déplacer les sommets librement ; navigation (pan) avec le bouton du
 *   milieu ou Alt+glisser ; zoom avec la molette.
 * • Ajouter des arcs en mode "addEdgeMode" : cliquer sur le sommet source →
 *   un anneau animé apparaît sur les cibles potentielles au survol →
 *   cliquer sur la destination → saisir le poids → confirmer.
 * • Clic droit sur un sommet ou un arc pour ouvrir un menu contextuel avec
 *   une option de suppression.
 * • Touche Suppr/Retour arrière pour supprimer le sommet actuellement
 *   sélectionné.
 * • Un simple clic sur le badge de poids d'un arc permet de l'éditer en
 *   ligne — c'est désormais son SEUL rôle ; il ne sert jamais de cible de
 *   glisser-déposer.
 * • Cliquer-glisser directement sur le tracé d'un arc (n'importe où le long
 *   de sa courbe, sauf sur le badge de poids) permet d'ajuster sa courbure.
 *   Il n'y a plus de poignée séparée — le tracé lui-même est la cible du
 *   glisser-déposer.
 * • Les badges de poids sont décalés perpendiculairement d'une distance
 *   minimale, pour rester lisibles sans trop s'éloigner du tracé.
 * • Les arcs bidirectionnels sont décalés latéralement pour que les deux
 *   tracés restent visibles.
 * • Les pointes de flèche peuvent être activées/désactivées globalement
 *   (voir `showArrows`) pour correspondre à la notation en traits simples
 *   utilisée dans le support de cours.
 * • Quand plusieurs chemins optimaux sont à égalité de poids (mode "chemin
 *   multiple", voir `pathDisplayMode` dans le store), chacun est dessiné en
 *   surimpression avec sa propre couleur — voir MULTI_PATH_STYLES ci-dessous.
 *     - Un arc (ou un sommet) emprunté par plusieurs chemins optimaux à la
 *       fois n'a plus de couleur "tronc commun" fixe : il adopte la couleur
 *       du PREMIER chemin (le plus petit index, dans l'ordre "Chemin 1",
 *       "Chemin 2"...) à passer par lui. Les chemins suivants qui
 *       l'empruntent aussi ne le recolorent jamais — la couleur du premier
 *       arrivé est conservée, pour une représentation fidèle du parcours
 *       réel plutôt qu'une couleur arbitraire imposée à tout tronc partagé.
 *       Un tronçon partagé reste visuellement identifiable : trait plein
 *       (jamais en pointillé) et légèrement plus épais qu'un tronçon à
 *       chemin unique.
 *     - Les sommets appartenant à un seul chemin optimal sont coloriés en
 *       PLEIN dans la couleur de ce chemin (même traitement visuel que le
 *       mode "chemin unique" — fond plein + texte blanc — mais avec la
 *       couleur du chemin au lieu du bleu générique). Les sommets communs à
 *       plusieurs chemins (points de convergence/divergence) suivent la même
 *       règle du "premier chemin arrivé" que les arcs ci-dessus. Cette
 *       coloration est recalculée entièrement à chaque rendu et ne peut
 *       jamais retomber sur le bleu "optimal" générique du mode chemin
 *       unique — voir le paramètre `suppressOptimalBlue` de `nodeColors`
 *       plus bas, qui empêche explicitement cette fuite de couleur en mode
 *       "chemin multiple".
 * • Isolement visuel au survol (StepsPanel) : quand un chemin est survolé
 *   dans le panneau des étapes (`hoveredPathIndex` dans le store), tous les
 *   nœuds et arcs qui n'appartiennent PAS à ce chemin sont fortement
 *   estompés ici, pour rester lisible même à 5 chemins ou plus. Effet
 *   purement transitoire : il n'affecte jamais `pathDisplayMode`.
 *
 * Contrat avec le store (useGraphStore)
 * ──────────────────────────────
 *   nodes, edges            – données du graphe
 *   moveNode(id, x, y)      – met à jour la position d'un sommet
 *   addEdge(edge)           – insère un nouvel arc
 *   updateEdgeWeight(id, w) – change le poids d'un arc existant
 *   removeEdge(id)          – supprime un arc par son id
 *   removeNode(id)          – supprime un sommet et ses arcs incidents
 *   setCanvasSize(w, h)     – notifie le store des dimensions du SVG
 *   getNodeLambda(id)       – valeur λ affichée au-dessus du sommet (optionnel)
 *   isNodeMarked / isCurrentNode / isSelectedEdge
 *   isNodeInOptimalPath / isEdgeInOptimalPath
 *   pathDisplayMode / getPathIndicesForEdge – chemins optimaux multiples
 *   currentStepIndex        – nécessaire pour invalider correctement les
 *                             memos dérivés de l'étape courante (voir
 *                             `nodePathIndices` plus bas)
 *   hoveredPathIndex        – chemin actuellement survolé dans StepsPanel,
 *                             ou null ; pilote l'estompage décrit ci-dessus
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

// ─── Constantes de mise en page & de style ────────────────────────────────

const NODE_RADIUS = 23;

/** Courbure de la bézier quadratique : fraction de la longueur de l'arc, plafonnée à MAX_CURVE */
const CURVE_FACTOR = 0.15;
const MAX_CURVE    = 40;

/**
 * Décalage latéral (px) appliqué à chaque tracé d'une paire bidirectionnelle
 * pour que les deux arcs ne se chevauchent pas.
 */
const BIDIRECTIONAL_OFFSET = 14;

/** Distance (px) dont le badge de poids est poussé perpendiculairement hors
 *  du tracé. Une petite valeur garde le libellé proche ; 0 le centrerait
 *  directement sur le tracé lui-même. */
const WEIGHT_PERP_OFFSET = -1;

const ZOOM_MIN  = 0.15;
const ZOOM_MAX  = 4;
const ZOOM_STEP = 1.02;

// Géométrie du badge de poids
const BADGE_H       = 20;
const BADGE_PAD_X   = 8;   // marge horizontale interne de la pastille
const BADGE_MIN_W   = 24;

// ────────────────────────────────────────────────────────────────────────
// STYLES DES CHEMINS OPTIMAUX MULTIPLES — à modifier ici uniquement.
// ────────────────────────────────────────────────────────────────────────
// Utilisé quand `pathDisplayMode === "all"` (sélecteur "Chemin multiple"
// dans GraphPage) : chaque chemin optimal distinct est dessiné en overlay
// avec le style d'index correspondant, sur toute sa longueur. Un tronçon
// partagé par plusieurs chemins adopte la couleur du PREMIER chemin (index
// le plus petit) qui l'emprunte — voir le rendu des arcs plus bas. S'il y a
// plus de chemins que d'entrées ici, le tableau boucle (modulo) — les
// couleurs se répètent mais le décalage latéral (MULTI_PATH_LATERAL_GAP)
// reste unique par chemin, donc les tracés restent distinguables même
// au-delà de 6.
//
//   stroke : couleur du trait (n'importe quelle couleur CSS valide)
//   dash   : motif strokeDasharray ; `undefined` = trait plein
//   label  : nom affiché (sélecteur GraphPage / légende StepsPanel)
//
// Exemple pour repasser TOUT en traits pleins de couleurs différentes :
// remplacer chaque `dash` par `undefined`.
export const MULTI_PATH_STYLES = [
  {
    stroke: "#2563eb",
    marker: "url(#arrow-blue)",
    dash: undefined,
    label: "Chemin 1",
  },
  {
    stroke: "#f97316",
    marker: "url(#arrow-orange)",
    dash: "8 4",
    label: "Chemin 2",
  },
  {
    stroke: "#16a34a",
    marker: "url(#arrow-green)",
    dash: "8 4",
    label: "Chemin 3",
  },
  {
    stroke: "#db2777",
    marker: "url(#arrow-pink)",
    dash: "1 4",
    label: "Chemin 4",
  },
  {
    stroke: "#8b5cf6",
    marker: "url(#arrow-purple)",
    dash: "10 4 2 4",
    label: "Chemin 5",
  },
  {
    stroke: "#ca8a04",
    marker: "url(#arrow-yellow)",
    dash: "6 3",
    label: "Chemin 6",
  },
];

export const MULTI_PATH_COMMON_COLOR = "#1d4ed8"; // 

/**
 * Décalage latéral additionnel (px) entre deux chemins optimaux superposés
 * en mode "multiple", pour que les tracés parallèles restent visuellement
 * distincts même quand plusieurs chemins partagent un même arc.
 */
export const MULTI_PATH_LATERAL_GAP = 9;

/** Épaisseur des tracés d'overlay des chemins multiples. */
const MULTI_PATH_STROKE_WIDTH = 2.4;

/** Opacité appliquée aux nœuds/arcs qui n'appartiennent PAS au chemin
 *  survolé, pendant qu'un survol est actif dans StepsPanel. Volontairement
 *  bas pour que le chemin isolé ressorte nettement, même à 5+ chemins. */
const HOVER_DIM_OPACITY = 0.14;

// ─── Types ──────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  /** Quand true, le canevas est en mode "ajout d'arc" : cliquer sur les sommets les relie. */
  addEdgeMode?: boolean;
  /**
   * Interrupteur global pour les pointes de flèche sur tous les arcs
   * (nouveaux, en prévisualisation, en attente ou existants). Quand false,
   * les arcs sont dessinés comme de simples traits — pour correspondre à la
   * notation non orientée utilisée dans le support de cours. Volontairement
   * PAS réglable arc par arc.
   */
  showArrows?: boolean;
  onEdgeModeCancel?: () => void;
}

interface PendingEdge {
  fromId: string;
  toId:   string;
  /** Position en espace SVG du milieu de l'arc, utilisée pour ancrer le popup de poids. */
  midX:   number;
  midY:   number;
}

interface XY { x: number; y: number }

// ─── Fonctions utilitaires de géométrie ───────────────────────────────────

/** Retourne le vecteur unitaire et la longueur entre `from` et `to`. */
function vec(from: XY, to: XY) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len > 0
    ? { dx, dy, len, nx: dx / len, ny: dy / len }
    : { dx: 0, dy: 0, len: 0, nx: 0, ny: 0 };
}

/** Décalage du sommet de la courbe de Bézier : proportionnel à la longueur
 *  de l'arc, plafonné pour éviter des courbes trop prononcées. */
function curvature(len: number) {
  return Math.min(MAX_CURVE, len * CURVE_FACTOR);
}

/**
 * Construit un tracé SVG en bézier quadratique entre les centres de deux sommets.
 *
 * @param lateralOffset  Décalage perpendiculaire supplémentaire (utilisé pour
 *                       les paires bidirectionnelles afin que les deux arcs
 *                       ne se chevauchent pas, et pour les chemins multiples
 *                       superposés).
 * @param startRadius    Distance depuis le centre de `from` à laquelle le tracé démarre (par défaut : NODE_RADIUS).
 * @param endRadius      Distance depuis le centre de `to` à laquelle le tracé se termine.
 */
function buildEdgePath(
  from: XY, to: XY,
  lateralOffset: number = 0,
  startRadius: number  = NODE_RADIUS,
  endRadius: number    = NODE_RADIUS,
): string {
  const { len, nx, ny } = vec(from, to);
  if (len < 2) return "";

  // Rogne le début/la fin du tracé aux limites des cercles des sommets
  const x1 = from.x + nx * startRadius;
  const y1 = from.y + ny * startRadius;
  const x2 = to.x   - nx * endRadius;
  const y2 = to.y   - ny * endRadius;

  // Point de contrôle : milieu décalé perpendiculairement à la direction de l'arc
  const totalOffset = curvature(len) + lateralOffset;
  const mx = (x1 + x2) / 2 - ny * totalOffset;
  const my = (y1 + y2) / 2 + nx * totalOffset;

  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

/**
 * Point sur la bézier quadratique à t = 0.5 (c'est-à-dire le milieu visuel
 * du tracé). C'est là que le badge de poids est ancré, et la position par
 * défaut utilisée pour calculer la projection lors du glisser de courbure.
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
 * Position du badge de poids : le milieu du tracé, décalé d'une petite
 * distance supplémentaire le long de la perpendiculaire pour que le badge
 * se place juste à côté du trait, pas dessus.
 *
 * Volontairement gardé petit (WEIGHT_PERP_OFFSET) — juste assez pour éviter
 * le chevauchement sans éloigner le libellé de son tracé.
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

/** Tracé cubique de boucle réflexive, qui démarre et se termine au même sommet. */
function buildSelfLoopPath(node: XY): string {
  const r = NODE_RADIUS;
  const x = node.x + r * 0.7;
  const y = node.y - r * 0.7;
  return `M ${node.x + r * 0.5} ${node.y - r * 0.5}
          C ${x + 30} ${y - 40}, ${x + 50} ${y + 20}, ${node.x + r} ${node.y}`;
}

/** Milieu visuel approximatif d'une boucle réflexive (pour le placement du badge). */
function selfLoopMid(node: XY): XY {
  return { x: node.x + NODE_RADIUS + 30, y: node.y - NODE_RADIUS - 20 };
}

/** Estime la largeur affichée d'une chaîne en police monospace, pour
 *  dimensionner dynamiquement le badge. */
function monoTextWidth(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.62;
}

/** Vrai pour les chaînes que parseFloat accepterait comme un poids fini et réel. */
function isValidWeightInput(raw: string): boolean {
  if (raw.trim() === "") return false;
  return Number.isFinite(parseFloat(raw));
}

/** Convertit une couleur hexadécimale en `rgba(...)` avec une opacité
 *  donnée. Conservée pour d'éventuels usages futurs (halo, légendes...),
 *  mais n'est plus utilisée pour le fond des sommets en mode "chemin
 *  multiple" — celui-ci est désormais plein (voir plus bas), exactement
 *  comme en mode "chemin unique". */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full  = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Composants SVG internes ──────────────────────────────────────────────
// L'utilisation de tracés SVG purs évite toute dépendance à une librairie
// d'icônes et garde les icônes nettes à n'importe quelle échelle.

// ─── Sous-composants réutilisables ────────────────────────────────────────

/** <marker> SVG pour les pointes de flèche — un par variante de couleur. */
interface ArrowMarkerProps { id: string; fill: string }
const ArrowMarker = memo(({ id, fill }: ArrowMarkerProps) => (
  <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
    <path d="M0,0 L0,6 L8,3 z" fill={fill} />
  </marker>
));

// ── Popup de saisie du poids ───────────────────────────────────────────────
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
 * Popup flottant qui apparaît au-dessus du canevas (hors de la transformation
 * de zoom) pour recueillir le poids d'un arc nouvellement tracé. Positionné
 * en espace écran pour ne pas être mis à l'échelle avec le zoom.
 */
const WeightPopup = memo(({
  midX, midY, value, zoom, pan, onConfirm, onCancel, onChange, inputRef,
}: WeightPopupProps) => {
  const invalid = !isValidWeightInput(value);
  return (
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
              if (e.key === "Enter")  { e.preventDefault(); if (!invalid) onConfirm(); }
              if (e.key === "Escape") onCancel();
            }}
            aria-label="Poids de l'arc"
            aria-invalid={invalid}
            style={{
              width: 62, padding: "5px 8px", fontSize: 13, fontWeight: 600,
              border: `1px solid ${invalid ? "#fca5a5" : "#ede9fe"}`, borderRadius: 8, outline: "none",
              color: "#5b21b6", background: invalid ? "#fef2f2" : "#faf5ff",
              fontFamily: "ui-monospace, monospace",
            }}
          />
          <button
            onClick={onConfirm} aria-label="Confirmer"
            disabled={invalid}
            style={{
              flex: 1, background: invalid ? "#c4b5fd" : "#7c3aed", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 12,
              fontWeight: 700, cursor: invalid ? "not-allowed" : "pointer", padding: "5px 0",
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
  );
});

// ── Menu contextuel ────────────────────────────────────────────────────────
interface ContextMenuProps {
  /** Position en espace graphe SVG (à l'intérieur de la transformation zoom/pan). */
  x: number; y: number;
  /** Libellé d'en-tête affiché en haut du menu ("Sommet" / "Arc"). */
  label: string;
  onDelete: () => void;
  onClose:  () => void;
}

/**
 * Menu contextuel minimal (clic droit) rendu à l'intérieur du groupe de
 * transformation SVG. Propose une unique action "Supprimer" avec une icône
 * de corbeille.
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
      {/* En-tête */}
      <div style={{
        padding: "4px 12px 5px",
        fontSize: 10, color: "#94a3b8", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.07em",
        borderBottom: "1px solid #f1f5f9",
      }}>
        {label}
      </div>

      {/* Action de suppression */}
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

// ─── Composant principal ───────────────────────────────────────────────────

export default function GraphCanvas({ addEdgeMode = false, showArrows = true }: GraphCanvasProps) {
  const {
    nodes, edges,
    setCanvasSize,
    getNodeLambda,
    isNodeMarked, isCurrentNode, isSelectedEdge,
    isNodeInOptimalPath, isEdgeInOptimalPath,
    pathDisplayMode, getPathIndicesForEdge,
    // currentStepIndex : nécessaire uniquement pour invalider correctement
    // le useMemo `nodePathIndices` plus bas (voir son commentaire) — pas
    // utilisé directement dans le JSX.
    currentStepIndex,
    // hoveredPathIndex : chemin survolé dans StepsPanel, pilote l'estompage
    // des nœuds/arcs qui n'en font pas partie (lisibilité à 5+ chemins).
    hoveredPathIndex,
    moveNode, addEdge,
    updateEdgeWeight,
    removeEdge,
    removeNode,
  } = useGraphStore();

  // ── État d'interaction des sommets ─────────────────────────────────────────
  /** Id du sommet actuellement en cours de glisser-déposer. */
  const [dragging,  setDragging]  = useState<string | null>(null);
  /** Id du sommet "sélectionné" (affiché avec un anneau en pointillés). */
  const [selected,  setSelected]  = useState<string | null>(null);
  /** Id de l'arc actuellement survolé par la souris. */
  const [hovered,   setHovered]   = useState<string | null>(null);
  /**
   * En addEdgeMode : le sommet cliqué en premier (la source).
   * Un anneau animé est affiché autour de lui jusqu'à ce qu'une
   * destination soit choisie.
   */
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  /**
   * En addEdgeMode : le sommet survolé par la souris quand une source a
   * déjà été sélectionnée. Un second anneau animé (turquoise) est affiché
   * pour indiquer que ce sommet deviendrait la destination.
   */
  const [edgeHoverTarget, setEdgeHoverTarget] = useState<string | null>(null);
  /** Position courante du curseur en espace SVG, utilisée pour dessiner l'arc de prévisualisation en pointillés. */
  const [cursorPos,  setCursorPos]  = useState<XY | null>(null);
  /** Arc tracé mais pas encore confirmé (en attente de la saisie du poids). */
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  /** Valeur contrôlée du champ de poids à l'intérieur de WeightPopup. */
  const [weightInput, setWeightInput] = useState<string>("");

  // ── Édition du poids d'un arc en ligne ──────────────────────────────────────
  /** Id de l'arc dont le poids est en cours d'édition en ligne. */
  const [editingEdge,      setEditingEdge]      = useState<string | null>(null);
  const [editingEdgeValue, setEditingEdgeValue] = useState<string>("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Glisser-déposer de la courbure d'un arc ─────────────────────────────────
  /**
   * Id de l'arc actuellement en cours de courbure par un cliquer-glisser
   * directement sur son tracé. Il n'y a plus de poignée séparée — la zone
   * de détection (large, invisible) du tracé lui-même est la cible du
   * glisser-déposer, donc cela fonctionne depuis n'importe quel point du
   * tracé sauf le badge de poids.
   */
  const [draggingEdge, setDraggingEdge] = useState<string | null>(null);
  /**
   * Décalage perpendiculaire supplémentaire accumulé par arc en glissant
   * son tracé. Indexé par id d'arc.
   */
  const [edgeOffsets, setEdgeOffsets] = useState<Record<string, number>>({});

  // ── Menu contextuel ──────────────────────────────────────────────────────────
  interface CtxMenu { x: number; y: number; type: "node" | "edge"; id: string }
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // ── Zoom / pan ─────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState<XY>({ x: 0, y: 0 });
  const isPanning   = useRef(false);
  const panStart    = useRef<XY>({ x: 0, y: 0 });
  const panOrigin   = useRef<XY>({ x: 0, y: 0 });

  // ── Références diverses ──────────────────────────────────────────────────────
  const svgRef        = useRef<SVGSVGElement>(null);
  const dragOffset    = useRef<XY>({ x: 0, y: 0 });
  const weightInputRef = useRef<HTMLInputElement>(null);
  /** Mis à true dès que le pointeur bouge pendant un glisser ; empêche le déclenchement d'un click. */
  const didDrag = useRef(false);

  // ── Données dérivées / mémoïsées ──────────────────────────────────────────────

  /** Map des sommets normalisée avec des coordonnées de repli sûres. */
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
   * Ensemble des clés d'arc (ex. "A->B") qui ont un arc inverse
   * correspondant. Utilisé pour décider quand appliquer BIDIRECTIONAL_OFFSET.
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

  // Évite les fuites mémoire des décalages de courbure par arc une fois qu'un arc est supprimé.
  useEffect(() => {
    setEdgeOffsets((prev) => {
      const liveIds = new Set(safeEdges.map((e) => e.id));
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, off] of Object.entries(prev)) {
        if (liveIds.has(id)) next[id] = off;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [safeEdges]);

  const getNode = useCallback((id: string) => nodeMap.get(id), [nodeMap]);

  const getLateralOffset = useCallback(
    (edge: GraphEdge): number =>
      bidirectionalSet.has(`${edge.from}->${edge.to}`) ? BIDIRECTIONAL_OFFSET : 0,
    [bidirectionalSet]
  );

  /** Chaîne de tracé SVG complète pour un arc (ou une boucle réflexive). */
  const getEdgePath = useCallback((edge: GraphEdge): string => {
    const from = getNode(edge.from);
    const to   = getNode(edge.to);
    if (!from || !to) return "";
    if (from.id === to.id) return buildSelfLoopPath(from);
    const extra = edgeOffsets[edge.id] ?? 0;
    return buildEdgePath(from, to, getLateralOffset(edge) + extra);
  }, [getNode, getLateralOffset, edgeOffsets]);

  /**
   * Position du badge de poids, légèrement décalée hors du tracé.
   * Voir `weightBadgePos` pour la logique derrière WEIGHT_PERP_OFFSET.
   */
  const getWeightBadgePos = useCallback((edge: GraphEdge): XY => {
    const from = getNode(edge.from);
    const to   = getNode(edge.to);
    if (!from || !to) return { x: 0, y: 0 };
    if (from.id === to.id) return selfLoopMid(from);
    const extra = edgeOffsets[edge.id] ?? 0;
    return weightBadgePos(from, to, getLateralOffset(edge), extra);
  }, [getNode, getLateralOffset, edgeOffsets]);

  /** Milieu géométrique du tracé d'un arc (utilisé pour positionner le menu contextuel). */
  const getEdgeMid = useCallback((edge: GraphEdge): XY => {
    const from = getNode(edge.from);
    const to   = getNode(edge.to);
    if (!from || !to) return { x: 0, y: 0 };
    if (from.id === to.id) return selfLoopMid(from);
    const extra = edgeOffsets[edge.id] ?? 0;
    return bezierMid(from, to, getLateralOffset(edge) + extra);
  }, [getNode, getLateralOffset, edgeOffsets]);

  /**
   * Map sommet → ensemble des index de chemins optimaux qui passent par ce
   * sommet, calculée uniquement en mode "chemin multiple" (pathDisplayMode
   * === "all"). Construite côté canevas à partir de `getPathIndicesForEdge`
   * (déjà exposé par le store pour les arcs) en agrégeant, pour chaque arc,
   * ses index de chemin sur ses deux sommets extrémités — pas besoin d'une
   * nouvelle méthode dédiée dans le store.
   *
   * Recalculée entièrement à chaque rendu à partir des seuls chemins
   * optimaux actuellement renvoyés par le store (aucun état intermédiaire
   * conservé d'un rendu à l'autre) : avancer/reculer dans les étapes ne peut
   * donc jamais laisser un sommet avec un ensemble de chemins obsolète.
   *
   * FIX (bug : les "fonds" de couleur sur les nœuds ne se réinitialisaient
   * pas correctement en cliquant "Précédent" dans StepsPanel) : ce
   * useMemo dépendait de `[pathDisplayMode, safeEdges, getPathIndicesForEdge]`.
   * `getPathIndicesForEdge` est une référence de fonction STABLE exposée par
   * le store (elle ne change jamais d'identité), mais elle lit
   * `currentStepIndex` en interne via `get()`. Résultat : naviguer dans les
   * étapes déclenchait bien un re-render du composant, mais PAS un
   * recalcul de ce memo — React ne voyait aucune dépendance changée. Les
   * nœuds gardaient donc la carte de couleurs de l'étape précédente,
   * donnant l'impression que les fonds "ne disparaissaient pas". Ajout de
   * `currentStepIndex` dans le tableau de dépendances : le memo est
   * désormais recalculé à chaque changement d'étape, comme le sont déjà les
   * arcs (calculés en direct dans le JSX, jamais mémoïsés).
   *
   * Un sommet avec un seul index dans son ensemble n'appartient qu'à un
   * chemin : il est teinté dans la couleur de ce chemin. Un sommet avec
   * plusieurs index est un point de convergence/divergence entre plusieurs
   * chemins optimaux : il prend la couleur du PREMIER de ces chemins (voir
   * le rendu des sommets plus bas).
   */
  const nodePathIndices = useMemo<Map<string, Set<number>>>(() => {
    const map = new Map<string, Set<number>>();
    if (pathDisplayMode !== "all") return map;
    safeEdges.forEach((edge) => {
      const idxs = getPathIndicesForEdge(edge.from, edge.to);
      if (!idxs.length) return;
      [edge.from, edge.to].forEach((nodeId) => {
        if (!map.has(nodeId)) map.set(nodeId, new Set());
        const set = map.get(nodeId)!;
        idxs.forEach((i) => set.add(i));
      });
    });
    return map;
  }, [pathDisplayMode, safeEdges, getPathIndicesForEdge, currentStepIndex]);

  // ── Conversion de coordonnées ─────────────────────────────────────────────

  /** Espace client (écran) → espace graphe SVG, en tenant compte du zoom/pan courants. */
  const getSvgCoords = useCallback((clientX: number, clientY: number): XY => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ── Effet : réinitialise l'état du mode d'ajout d'arc à la sortie du mode ────
  useEffect(() => {
    if (!addEdgeMode) {
      setEdgeSource(null);
      setEdgeHoverTarget(null);
      setCursorPos(null);
      setPendingEdge(null);
      setWeightInput("");
    }
  }, [addEdgeMode]);

  // ── Effet : focus automatique du champ de poids à l'apparition du popup ─────
  useEffect(() => {
    if (pendingEdge && weightInputRef.current) {
      const t = setTimeout(() => weightInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [pendingEdge]);

  // ── Effet : sélection automatique du texte dans le champ d'édition en ligne ─
  useEffect(() => {
    if (editingEdge && editInputRef.current) {
      editInputRef.current.select();
    }
  }, [editingEdge]);

  // ── Effet : ferme le menu contextuel sur tout clic extérieur ────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [ctxMenu]);

  // ── Fonctions utilitaires de zoom ────────────────────────────────────────────

  /**
   * Applique un nouveau niveau de zoom, en pivotant éventuellement autour
   * d'un point en espace écran (clientX / clientY) pour que le contenu sous
   * le curseur reste fixe.
   */
  const applyZoom = useCallback((nextZoom: number, pivotX?: number, pivotY?: number) => {
    setZoom((prev) => {
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
      if (pivotX !== undefined && pivotY !== undefined && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const px = pivotX - rect.left;
        const py = pivotY - rect.top;
        // Ajuste le pan pour que le point pivot reste invariant
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

  /** Cadre tous les sommets dans la zone visible avec une marge. */
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

  // ── Événements pointeur du SVG ───────────────────────────────────────────────

  /** Molette : zoom en pivotant sur la position du curseur (comportement façon Figma). */
  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    applyZoom(zoom * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP), e.clientX, e.clientY);
  }, [applyZoom, zoom]);

  /** Bouton du milieu ou Alt+clic gauche+glisser démarre le pan. */
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
    // ── Pan ──
    if (isPanning.current) {
      setPan({
        x: panOrigin.current.x + (e.clientX - panStart.current.x),
        y: panOrigin.current.y + (e.clientY - panStart.current.y),
      });
      return;
    }

    // ── Glisser-déposer de la courbure d'un arc (démarré en pressant sur le tracé lui-même) ──
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
          // Projette le déplacement du curseur sur l'axe perpendiculaire
          const proj = (svgC.x - midX) * (-ny) + (svgC.y - midY) * nx;
          setEdgeOffsets((prev) => ({ ...prev, [draggingEdge]: proj - getLateralOffset(edge) }));
        }
      }
      return;
    }

    // ── Glisser-déposer d'un sommet ──
    if (dragging) {
      didDrag.current = true;
      const { x, y } = getSvgCoords(e.clientX, e.clientY);
      moveNode(dragging, x - dragOffset.current.x, y - dragOffset.current.y);
      return;
    }

    // ── Prévisualisation du tracé pendant la sélection de la destination ──
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

  // ── Événements sur les sommets ────────────────────────────────────────────────

  const onPointerDownNode = useCallback(
    (e: ReactPointerEvent<SVGGElement>, id: string) => {
      if (addEdgeMode) return; // les clics sont gérés par onClickNode dans ce mode
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
   * En addEdgeMode : le premier clic choisit la source, le second clic (sur
   * un sommet différent) choisit la destination et ouvre le popup de poids.
   * Cliquer deux fois sur le même sommet crée une boucle réflexive.
   */
  const onClickNode = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (!addEdgeMode) return;
      e.stopPropagation();
      if (pendingEdge) return; // déjà en attente de la saisie du poids

      if (!edgeSource) {
        // Étape 1 : sélection de la source
        setEdgeSource(id);
      } else if (edgeSource === id) {
        // Étape 2a : boucle réflexive
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
        // Étape 2b : arc normal
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

  /** Clic droit sur un sommet → menu contextuel. */
  const onContextMenuNode = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (addEdgeMode) return;
      e.preventDefault();
      e.stopPropagation();
      const node = nodeMap.get(id);
      if (!node) return;
      // Positionne le menu près du bord droit du sommet, en espace SVG
      setCtxMenu({ x: node.x + NODE_RADIUS + 6, y: node.y - 14, type: "node", id });
    },
    [addEdgeMode, nodeMap]
  );

  /** Clic droit sur un arc → menu contextuel. */
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

  // ── Confirmation / annulation d'un arc ───────────────────────────────────────

  const confirmEdge = useCallback(() => {
    if (!pendingEdge) return;
    if (!isValidWeightInput(weightInput)) return;
    const w = parseFloat(weightInput);
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

  // ── Édition du poids en ligne ────────────────────────────────────────────────

  const startEditEdge = useCallback((edge: GraphEdge) => {
    if (addEdgeMode) return;
    setEditingEdge(edge.id);
    setEditingEdgeValue(String(edge.weight));
  }, [addEdgeMode]);

  /**
   * Valide l'édition du poids en ligne. Correction de bug : ceci appelle
   * désormais `updateEdgeWeight` — l'action réellement exposée par le store
   * (une version précédente appelait une fonction qui n'existait pas sur le
   * store, donc les éditions ne faisaient rien silencieusement).
   */
  const confirmEditEdge = useCallback(() => {
    if (!editingEdge) return;
    if (isValidWeightInput(editingEdgeValue)) {
      const w = parseFloat(editingEdgeValue);
      updateEdgeWeight?.(editingEdge, w);
    }
    setEditingEdge(null);
  }, [editingEdge, editingEdgeValue, updateEdgeWeight]);

  const cancelEditEdge = useCallback(() => {
    setEditingEdge(null);
    setEditingEdgeValue("");
  }, []);

  // ── Glisser-déposer de la courbure, démarré directement depuis la zone de détection du tracé ─

  /**
   * Presser n'importe où sur la zone de détection (large, invisible) d'un
   * arc démarre un glisser de courbure. Il n'y a plus de poignée séparée —
   * le tracé lui-même est la cible du glisser-déposer. Le badge de poids
   * est posé par-dessus le tracé mais possède son propre gestionnaire
   * onClick (startEditEdge) et stoppe la propagation, donc presser sur le
   * badge ne démarre jamais un glisser de courbure — il est réservé
   * uniquement à l'édition de la valeur du poids.
   */
  const onPointerDownEdge = useCallback(
    (e: React.PointerEvent, edgeId: string) => {
      if (addEdgeMode) return;
      e.stopPropagation();
      setDraggingEdge(edgeId);
    },
    [addEdgeMode]
  );

  // ── Clic sur l'arrière-plan du SVG ────────────────────────────────────────────

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

  // ── Raccourcis clavier ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if      (pendingEdge)  cancelPendingEdge();
        else if (editingEdge)  cancelEditEdge();
        else                   setCtxMenu(null);
      }
      // Suppr/Retour arrière quand un sommet est sélectionné (et pas dans un champ)
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
  }, [pendingEdge, editingEdge, selected, cancelPendingEdge, cancelEditEdge, removeNode]);

  // ── Événements des boutons de la barre d'outils (émis via window) ──────────────
  useEffect(() => {
    const handlers: [string, () => void][] = [
      ["graph-zoom-in",  zoomIn],
      ["graph-zoom-out", zoomOut],
      ["graph-fit-view", fitView],
    ];
    handlers.forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return ()        => handlers.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
  }, [zoomIn, zoomOut, fitView]);

  // ── Suivi de la taille du canevas ────────────────────────────────────────────
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

  // ── Tracé de prévisualisation (arc en pointillés qui suit le curseur) ───────
  const previewPath = useMemo(() => {
    if (!addEdgeMode || !edgeSource || pendingEdge || !cursorPos) return null;
    const from = nodeMap.get(edgeSource);
    if (!from) return null;
    return buildEdgePath(from, cursorPos, 0, NODE_RADIUS, 0);
  }, [addEdgeMode, edgeSource, pendingEdge, cursorPos, nodeMap]);

  // ── Fonctions utilitaires de style ───────────────────────────────────────────

  /**
   * Couleurs de base d'un sommet. `suppressOptimalBlue` désactive
   * explicitement la branche "bleu optimal" (mode chemin unique) : c'est
   * ELLE qui provoquait la fuite "parfois tout redevient bleu" en mode
   * "chemin multiple" — un sommet pouvait être considéré "optimal" par le
   * store sans être retrouvé dans `nodePathIndices` (reconstruction locale
   * basée sur les arcs), et retombait alors sur ce bleu générique au lieu
   * d'une couleur neutre. En mode "chemin multiple", c'est TOUJOURS la
   * coloration par chemin (ou neutre) plus bas qui doit avoir le dernier
   * mot, jamais ce bleu de base.
   */
  const nodeColors = useCallback((node: GraphNode, suppressOptimalBlue: boolean = false): NodeColors => {
    if (addEdgeMode) {
      if (edgeSource === node.id)     return { fill: "#2563eb", stroke: "#60a5fa", text: "#fff" };
      if (pendingEdge?.toId === node.id) return { fill: "#7c3aed", stroke: "#a78bfa", text: "#fff" };
      return { fill: "#f8fafc", stroke: "#cbd5e1", text: "#475569" };
    }
    if (!suppressOptimalBlue && isNodeInOptimalPath(node.id)) return { fill: "#2d6ef8", stroke: "#2d5ef8", text: "#fff" };
    if (isCurrentNode(node.id))        return { fill: "#f59e0b", stroke: "#fcd34d", text: "#fff" };
    if (isNodeMarked(node.id))         return { fill: "#fef08a", stroke: "#eab308", text: "#713f12" };
    return { fill: "#ffffff", stroke: "#e2e8f0", text: "#334155" };
  }, [addEdgeMode, edgeSource, pendingEdge, isNodeInOptimalPath, isCurrentNode, isNodeMarked]);

  /**
   * En mode "chemin multiple" (pathDisplayMode === "all"), la coloration
   * "optimal = bleu" du rendu de base est désactivée : c'est l'overlay des
   * chemins multiples (plus bas) qui colore chaque arc, une seule fois,
   * dans la couleur du premier chemin qui l'emprunte. Sans cette
   * désactivation, un arc optimal serait peint deux fois — d'abord en bleu
   * ici, puis dans sa vraie couleur par l'overlay — et le bleu de base,
   * plus épais, dépasserait visiblement de sous la couleur du dessus.
   */
  const edgeStrokeColor = useCallback((edge: GraphEdge): string => {
    if (isEdgeInOptimalPath(edge.from, edge.to) && pathDisplayMode !== "all") return "#2d6ef8";
    if (isSelectedEdge(edge.from, edge.to))      return "#f59e0b";
    if (hovered === edge.id)                      return "#64748b";
    return "#c1cfe0";
  }, [isEdgeInOptimalPath, isSelectedEdge, hovered, pathDisplayMode]);

  /**
   * Marqueur de pointe de flèche pour un arc donné. Retourne `undefined`
   * dès que `showArrows` est faux, pour que l'arc soit rendu comme un
   * simple trait, conformément à la notation non orientée du support de
   * cours. C'est un interrupteur global unique — volontairement pas de
   * dérogation par arc. Même logique que edgeStrokeColor ci-dessus : pas de
   * flèche bleue "optimal" en mode chemin multiple, pour ne pas doubler la
   * flèche que dessine déjà l'overlay.
   */
  const edgeMarker = useCallback((edge: GraphEdge): string | undefined => {
    if (!showArrows) return undefined;
    if (isEdgeInOptimalPath(edge.from, edge.to) && pathDisplayMode !== "all") return "url(#arrow-optimal)";
    if (isSelectedEdge(edge.from, edge.to))      return "url(#arrow-selected)";
    if (hovered === edge.id)                      return "url(#arrow-hover)";
    return "url(#arrow)";
  }, [showArrows, isEdgeInOptimalPath, isSelectedEdge, hovered, pathDisplayMode]);

  const svgCursor = isPanning.current
    ? "grabbing"
    : addEdgeMode
    ? (edgeSource ? "crosshair" : "cell")
    : (dragging ? "grabbing" : "default");

  // ─── Rendu ────────────────────────────────────────────────────────────────

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
      {/* ── Defs : marqueurs de flèche & filtres ──────────────────────────── */}
      <defs>
        <ArrowMarker id="arrow"          fill="#cbd5e1" />
        <ArrowMarker id="arrow-selected" fill="#f59e0b" />
        <ArrowMarker id="arrow-optimal"  fill="#1d4ed8" />
        <ArrowMarker id="arrow-preview"  fill="#3b82f6" />
        <ArrowMarker id="arrow-pending"  fill="#7c3aed" />
        <ArrowMarker id="arrow-hover"    fill="#64748b" />
        <ArrowMarker id="arrow-blue"   fill="#2563eb" />
        <ArrowMarker id="arrow-orange" fill="#f97316" />
        <ArrowMarker id="arrow-green"  fill="#16a34a" />
        <ArrowMarker id="arrow-pink"   fill="#db2777" />
        <ArrowMarker id="arrow-purple" fill="#8b5cf6" />
        <ArrowMarker id="arrow-yellow" fill="#ca8a04" />

        {/* Ombre portée discrète pour les sommets normaux */}
        <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.10" />
        </filter>
        {/* Filtres de halo pour les états mis en évidence */}
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

      {/* ── Groupe de transformation zoom / pan ─────────────────────────────── */}
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>

        {/* ════════════════════════════════════════════════════════════════════
            ARCS
            Rendus avant les sommets pour qu'ils apparaissent derrière les cercles.
            ════════════════════════════════════════════════════════════════════ */}
        {safeEdges.map((edge) => {
          const badgePos    = getWeightBadgePos(edge);
          // Idem edgeStrokeColor/edgeMarker : pas de style "optimal" bleu
          // ici en mode chemin multiple, c'est l'overlay qui colore l'arc.
          const isOptimal   = isEdgeInOptimalPath(edge.from, edge.to) && pathDisplayMode !== "all";
          const isSel       = isSelectedEdge(edge.from, edge.to);
          const isHov       = hovered === edge.id;
          const isDragThis  = draggingEdge === edge.id;
          const color       = edgeStrokeColor(edge);
          const strokeW     = isOptimal ? 2.8 : isSel ? 2.4 : (isHov || isDragThis) ? 2 : 1.7;
          const path        = getEdgePath(edge);
          const isEditing   = editingEdge === edge.id;

          // Estompage au survol d'un chemin (StepsPanel) : un arc qui ne fait
          // partie d'AUCUN chemin optimal n'est jamais concerné par ce survol
          // (il n'est ni mis en avant, ni davantage estompé qu'il ne l'est
          // déjà normalement) — seuls les arcs appartenant à un chemin sont
          // candidats à l'estompage s'ils n'appartiennent pas au chemin
          // survolé. Le rendu de base (ici) n'est de toute façon actif comme
          // "optimal" qu'en mode chemin unique ; en mode "all" c'est
          // l'overlay plus bas qui porte l'effet de survol pour les arcs.
          const weightStr = String(edge.weight);
          const badgeW    = Math.max(BADGE_MIN_W, monoTextWidth(weightStr) + BADGE_PAD_X * 2);
          const editInvalid = isEditing && !isValidWeightInput(editingEdgeValue);

          return (
            <g
              key={edge.id}
              onMouseEnter={() => setHovered(edge.id)}
              onMouseLeave={() => setHovered(null)}
              onContextMenu={(e) => onContextMenuEdge(e, edge)}
            >
              {/*
                Zone de détection large invisible : c'est ELLE la cible du
                glisser pour ajuster la courbure (plus de poignée séparée).
                Presser n'importe où le long du tracé — sauf sur le badge de
                poids, qui a son propre gestionnaire et stoppe la
                propagation — démarre un glisser de courbure.
              */}
              <path
                d={path} fill="none" stroke="transparent" strokeWidth={18}
                style={{ cursor: addEdgeMode ? "pointer" : (isDragThis ? "grabbing" : "grab") }}
                onPointerDown={(e) => onPointerDownEdge(e, edge.id)}
              />

              {/* Tracé visible */}
              <path
                d={path} fill="none"
                stroke={color} strokeWidth={strokeW} strokeLinecap="round"
                markerEnd={edgeMarker(edge)}
                style={{ transition: "stroke 0.12s, stroke-width 0.12s", pointerEvents: "none" }}
              />

              {/* Badge de poids — éditeur en ligne au clic. Réservé
                  UNIQUEMENT à l'édition de la valeur du poids : il stoppe
                  la propagation au clic pour que le presser dessus ne
                  démarre (ni n'interfère avec) jamais un glisser de
                  courbure sur le tracé sous-jacent. */}
              {isEditing ? (
                <foreignObject
                  x={badgePos.x - 32} y={badgePos.y - 16}
                  width={64} height={32}
                  style={{ overflow: "visible" }}
                >
                  <input
                    ref={editInputRef}
                    type="number"
                    step="any"
                    value={editingEdgeValue}
                    onChange={(e) => setEditingEdgeValue(e.target.value)}
                    onBlur={confirmEditEdge}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")  { e.preventDefault(); confirmEditEdge(); }
                      if (e.key === "Escape") { e.preventDefault(); cancelEditEdge(); }
                    }}
                    aria-invalid={editInvalid}
                    style={{
                      width: 60, textAlign: "center",
                      fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${editInvalid ? "#f87171" : "#7c3aed"}`, borderRadius: 8,
                      padding: "2px 4px",
                      fontFamily: "ui-monospace, monospace",
                      color: editInvalid ? "#b91c1c" : "#5b21b6",
                      background: editInvalid ? "#fef2f2" : "#faf5ff", outline: "none",
                    }}
                  />
                </foreignObject>
              ) : (
                // Badge statique — simple clic pour éditer
                <g
                  style={{ cursor: addEdgeMode ? "default" : "text" }}
                  onPointerDown={(e) => e.stopPropagation()}
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
            </g>
          );
        })}

        {/* ── Arc de prévisualisation (trait pointillé qui suit le curseur pendant la sélection de destination) */}
        {previewPath && (
          <path
            d={previewPath} fill="none"
            stroke="#3b82f6" strokeWidth={1.8} strokeDasharray="7 4"
            markerEnd={showArrows ? "url(#arrow-preview)" : undefined} opacity={0.7}
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* ── Arc en attente (pointillé, fixe ; affiché pendant que le popup de poids est ouvert) */}
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
              markerEnd={showArrows ? "url(#arrow-pending)" : undefined} opacity={0.85}
              style={{ pointerEvents: "none" }}
            />
          );
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            SOMMETS
            ════════════════════════════════════════════════════════════════════ */}
        {safeNodes.map((node) => {
          const lambdaVal = getNodeLambda?.(node.id) ?? null;
          const isSel     = selected === node.id;
          const isMarked  = isNodeMarked(node.id);
          const isCurrent = isCurrentNode(node.id);
          const isOptimal = isNodeInOptimalPath(node.id);

          // En addEdgeMode : sommet source (cliqué) et sommet survolé comme cible
          const isEdgeSrc = addEdgeMode && edgeSource === node.id;
          const isEdgeTgt = addEdgeMode && pendingEdge?.toId === node.id;
          /**
           * Cible survolée : sommet sous le curseur quand une source est
           * déjà sélectionnée. Affiche un anneau animé turquoise —
           * différent de l'anneau bleu de la source — pour signaler "ce
           * sommet deviendrait la destination".
           */
          const isEdgeHovTarget = addEdgeMode && !!edgeSource && !pendingEdge
            && edgeHoverTarget === node.id && edgeHoverTarget !== edgeSource;

          // ── Coloration par chemin optimal (mode "chemin multiple") ──
          // Uniquement active hors addEdgeMode, et seulement quand le sommet
          // n'est pas le sommet "courant" de l'algorithme pas-à-pas (surbrillance
          // ambre prioritaire). NB : on n'exclut PAS les sommets "marqués"
          // (isNodeMarked) — ce marquage reste vrai en permanence pour tout
          // sommet visité, même une fois le calcul terminé ; l'exclure aurait
          // désactivé la coloration par chemin pour la quasi-totalité des
          // sommets du graphe final, ce qui expliquait le "tout reste bleu".
          //
          // Règle : un sommet prend la couleur du PREMIER chemin (index le
          // plus petit dans `nodePathArr`, déjà trié croissant) qui passe
          // par lui — qu'il n'appartienne qu'à un seul chemin ou qu'il soit
          // un point de convergence/divergence partagé par plusieurs. Plus
          // de couleur "tronc commun" fixe : le sommet reflète le chemin qui
          // l'a réellement atteint en premier. `isSinglePathNode` /
          // `isCommonNode` ne servent plus qu'à ajuster l'épaisseur du trait
          // et le texte de l'info-bulle, jamais la couleur elle-même.
          // → toujours la même couleur que l'arc auquel le sommet est
          // rattaché, jamais un mélange, jamais une double coloration, et
          // surtout : jamais de retour furtif au bleu générique — voir
          // `suppressOptimalBlue` passé à `nodeColors` ci-dessous, qui
          // coupe cette fuite à la source.
          const showMultiPathStyle = pathDisplayMode === "all" && !addEdgeMode && !isCurrent;
          const nodePathSet = showMultiPathStyle ? (nodePathIndices.get(node.id) ?? new Set<number>()) : undefined;
          const nodePathArr = nodePathSet ? Array.from(nodePathSet).sort((a, b) => a - b) : [];
          const isSinglePathNode = showMultiPathStyle && nodePathArr.length === 1;
          const isCommonNode = showMultiPathStyle && nodePathArr.length > 1;

          let colors = nodeColors(node, pathDisplayMode === "all");
          if (nodePathArr.length > 0) {
            const firstPathIdx = nodePathArr[0];
            const style = MULTI_PATH_STYLES[firstPathIdx % MULTI_PATH_STYLES.length];
            colors = { fill: style.stroke, stroke: style.stroke, text: "#fff" };
          }

          // Estompage au survol d'un chemin dans StepsPanel (lisibilité à
          // 5+ chemins). Un nœud qui appartient à au moins un chemin, mais
          // PAS au chemin actuellement survolé, est fortement atténué le
          // temps du survol — ce qui isole visuellement le chemin qu'on
          // souhaite suivre sans changer `pathDisplayMode` ni aucun autre
          // état persistant. Les nœuds hors de tout chemin (le reste du
          // graphe) restent inchangés : seuls les chemins eux-mêmes sont
          // concernés par ce contraste.
          const isDimmedByHover =
            hoveredPathIndex !== null &&
            nodePathArr.length > 0 &&
            !nodePathArr.includes(hoveredPathIndex);
          const nodeOpacity = isDimmedByHover ? HOVER_DIM_OPACITY : 1;

          // Le bleu "optimal" générique (bordure fine, mode chemin unique)
          // ne doit jamais s'afficher en mode "chemin multiple" — sinon il
          // réapparaîtrait ponctuellement sur des sommets non couverts par
          // nodePathIndices, exactement le bug rapporté.
          const optimalBlueAllowed = isOptimal && pathDisplayMode !== "all";

          const filter = isEdgeSrc       ? "url(#glow-blue)"
            : isEdgeTgt                  ? "url(#glow-purple)"
            : isEdgeHovTarget            ? "url(#glow-teal)"
            : isCurrent                  ? "url(#glow-amber)"
            : "url(#node-shadow)";

          // NB : la sélection (`isSel`) n'a plus d'impact sur le contour
          // principal — elle reste visible via l'anneau en pointillés dédié
          // plus bas — pour ne jamais écraser la couleur d'un chemin.
          const strokeColor = isEdgeSrc        ? "#3b82f6"
            : isEdgeTgt                         ? "#7c3aed"
            : isEdgeHovTarget                   ? "#0d9488"
            : isCurrent                         ? "#fcd34d"
            : (isSinglePathNode || isCommonNode) ? colors.stroke
            : (!addEdgeMode && isSel)           ? "#3b82f6"
            : optimalBlueAllowed                ? "#60a5fa"
            : "#cbd5e1";

          const strokeWidth = (isEdgeSrc || isEdgeTgt || isEdgeHovTarget || isCurrent || optimalBlueAllowed || isSinglePathNode || isCommonNode)
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
                outline: "none", // anneau de focus natif supprimé ; on dessine le nôtre
                opacity: nodeOpacity,
                transition: "opacity 0.15s",
              }}
              filter={filter}
            >
              {/* ── Anneau animé de la source (bleu, horaire) ── */}
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

              {/* ── Anneau animé de la cible survolée (turquoise, anti-horaire, légèrement plus grand) ── */}
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

              {/* ── Anneau de sélection (pointillés statiques, uniquement hors addEdgeMode) ── */}
              {!addEdgeMode && isSel && dragging !== node.id && (
                <circle
                  r={NODE_RADIUS + 5} fill="none"
                  stroke="#3b82f6" strokeWidth={1.5}
                  strokeDasharray="4 3" opacity={0.5}
                />
              )}

              {/* ── Badge de la valeur λ (affiché au-dessus du sommet pendant le déroulé de l'algorithme) ── */}
              {lambdaVal !== null && lambdaVal !== undefined && isMarked && (
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

              {/* ── Cercle principal ── */}
              <circle
                r={NODE_RADIUS}
                fill={colors.fill} stroke={strokeColor} strokeWidth={strokeWidth}
                style={{ transition: "fill 0.15s, stroke 0.15s" }}
              />

              {/* Info-bulle d'accessibilité indiquant le statut de ce sommet
                  vis-à-vis des chemins optimaux, en mode "chemin multiple". */}
              {isCommonNode && (
                <title>
                  {`Nœud partagé par plusieurs chemins optimaux — coloré comme le ${MULTI_PATH_STYLES[nodePathArr[0] % MULTI_PATH_STYLES.length].label} (premier chemin à l'emprunter)`}
                </title>
              )}
              {isSinglePathNode && (
                <title>
                  {`Nœud du ${MULTI_PATH_STYLES[nodePathArr[0] % MULTI_PATH_STYLES.length].label}`}
                </title>
              )}

              {/* ── Libellé du sommet ── */}
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

        {/* ════════════════════════════════════════════════════════════════════
            CHEMINS OPTIMAUX MULTIPLES — overlay ("Chemin multiple" mode)
            Dessiné PAR-DESSUS les sommets pour rester bien visible même là où
            plusieurs chemins optimaux se superposent aux arcs normaux. Ce
            bloc ne s'active QU'en mode "all" (voir getPathIndicesForEdge).

            RÈGLE STRICTE : chaque arc concerné n'est colorié qu'UNE SEULE
            fois, avec UN SEUL tracé — jamais deux tracés superposés sur le
            même arc, et jamais de mélange de couleurs.

            COULEUR — un arc adopte la couleur du PREMIER chemin (index le
            plus petit parmi ceux qui l'empruntent, dans l'ordre "Chemin 1",
            "Chemin 2"...) à passer par lui :
              • Si cet arc n'est emprunté que par un seul chemin optimal,
                c'est simplement la couleur propre de ce chemin.
              • Si l'arc est un tronc partagé par 2 chemins ou plus, il
                prend la couleur du premier de ces chemins — plus de bleu
                "tronc commun" fixe et déconnecté du parcours réel. Les
                chemins suivants qui empruntent ce même arc ne le
                recolorent jamais : la couleur du premier arrivé est
                conservée.
            Il reste visuellement distinguable d'un arc à chemin unique par
            un trait plein (jamais en pointillé) et un peu plus épais.

            SURVOL (lisibilité à 5+ chemins) : quand `hoveredPathIndex` est
            défini, l'arc qui appartient à ce chemin est mis en avant (plus
            épais, pleine opacité) et tous les autres sont fortement
            estompés — sans jamais changer leur couleur propre ni
            `pathDisplayMode`.

            Ce calcul repart de zéro à chaque rendu à partir des seuls
            chemins optimaux actuellement renvoyés par le store — rien
            n'est mémorisé d'un rendu à l'autre — donc avancer/reculer dans
            les étapes ne peut jamais laisser un arc avec une couleur
            obsolète.

            Le rendu de base des arcs (plus haut) ne colore plus ces mêmes
            arcs en bleu "optimal" quand ce mode est actif (voir
            edgeStrokeColor / edgeMarker / le isOptimal local du bloc ARCS),
            donc il n'y a jamais de double coloration ni de couleur qui
            dépasse de sous une autre.
            ════════════════════════════════════════════════════════════════════ */}
            {pathDisplayMode === "all" && safeEdges.map((edge) => {
              const rawIndices = getPathIndicesForEdge(edge.from, edge.to);
              // S'il n'y a aucun chemin sur cet arc, on n'affiche rien
              if (!rawIndices.length) return null;

              const from = getNode(edge.from);
              const to   = getNode(edge.to);
              if (!from || !to || from.id === to.id) return null;

              // Décalage de base pour les arcs parallèles normaux du graphe
              // (bidirectionnels / courbure manuelle) — inchangé, pas de
              // décalage supplémentaire propre aux chemins multiples.
              const baseOffset = getLateralOffset(edge) + (edgeOffsets[edge.id] ?? 0);
              const overlayPath = buildEdgePath(from, to, baseOffset);

              // Tri croissant : l'index le plus petit = le PREMIER chemin
              // (dans l'ordre "Chemin 1", "Chemin 2"...) à emprunter cet
              // arc. Recalculé intégralement à chaque rendu à partir des
              // seuls chemins optimaux courants.
              const sortedIndices = [...rawIndices].sort((a, b) => a - b);
              const firstIdx = sortedIndices[0];
              const isShared = sortedIndices.length > 1;
              const style = MULTI_PATH_STYLES[firstIdx % MULTI_PATH_STYLES.length];

              // Survol depuis StepsPanel : isole le chemin survolé (plus
              // épais, pleine opacité) et estompe fortement tous les autres.
              const isHoveredPath = hoveredPathIndex !== null && sortedIndices.includes(hoveredPathIndex);
              const isDimmedPath  = hoveredPathIndex !== null && !isHoveredPath;
              const baseWidth = isShared ? MULTI_PATH_STROKE_WIDTH * 1.3 : MULTI_PATH_STROKE_WIDTH;

              return (
                <path
                  key={`${edge.id}-mp-${firstIdx}${isShared ? "-shared" : ""}`}
                  d={overlayPath}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={isHoveredPath ? baseWidth * 1.6 : baseWidth}
                  strokeDasharray={isShared ? undefined : style.dash}
                  strokeLinecap="round"
                  markerEnd={showArrows ? style.marker : undefined}
                  style={{
                    pointerEvents: "none",
                    opacity: isDimmedPath ? HOVER_DIM_OPACITY : (isShared ? 0.95 : 0.92),
                    transition: "opacity 0.15s, stroke-width 0.15s",
                  }}
                />
              );
            })}

        {/* ── Menu contextuel (à l'intérieur du groupe de transformation pour suivre le zoom/pan) ── */}
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

      {/* ── Popup de poids (hors transformation — position fixe en espace écran) ── */}
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