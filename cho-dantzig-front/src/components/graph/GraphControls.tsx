// components/graph/GraphControls.tsx
import { useEffect, useRef, useState } from "react";
import { useGraphStore } from "../../store/graphStore";

type Speed = 0.5 | 1 | 2 | 3 | 5 | 10;
type ButtonVariant = "default" | "danger" | "success" | "primary";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip flex items-center">
      {children}
      <div
        className={cx(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
          "px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none",
          "text-[10px] font-medium",
          "bg-slate-800 dark:bg-slate-700 text-white",
          "opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150",
          "shadow-lg"
        )}
      >
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
      </div>
    </div>
  );
}

// ─── Icon button ──────────────────────────────────────────────────────────────
function IconButton({
  onClick,
  active = false,
  disabled = false,
  tooltip,
  children,
  variant = "default",
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
}) {
  const base = cx(
    "w-8 h-8 rounded-lg flex items-center justify-center",
    "transition-all duration-150 active:scale-95",
    "disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
  );

  const variants: Record<ButtonVariant, string> = {
    default: active
      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200",
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/15",
    danger:
      "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
    success:
      "text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300",
  };

  return (
    <Tooltip label={tooltip}>
      <button
        className={cx(base, variants[variant])}
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
      >
        {children}
      </button>
    </Tooltip>
  );
}

// ─── Separator ────────────────────────────────────────────────────────────────
function Sep() {
  return (
    <div className="w-px h-5 bg-slate-200 dark:bg-white/8 mx-0.5 flex-shrink-0" />
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icons = {
  reset: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <path d="M2 8a6 6 0 1 1 1.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 12V8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  prev: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M5 3.5l8 4.5-8 4.5V3.5z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <rect x="3" y="3" width="3.5" height="10" rx="1" />
      <rect x="9.5" y="3" width="3.5" height="10" rx="1" />
    </svg>
  ),
  first: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <path d="M13 4v8M9 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  last: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <path d="M3 4v8M7 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  fit: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  zoomIn: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5l3 3M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  zoomOut: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5l3 3M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  generate: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill="currentColor"
      />

      <circle cx="20" cy="5" r="1" fill="currentColor"/>
      <circle cx="5" cy="18" r="1" fill="currentColor"/>
      <circle cx="18" cy="18" r="0.8" fill="currentColor"/>
    </svg>
  ),
};

// ─── Step indicator dots ──────────────────────────────────────────────────────
function StepDots({
  total,
  current,
  onChange,
}: {
  total: number;
  current: number;
  onChange: (i: number) => void;
}) {
  // Afficher max 12 dots, sinon afficher un compteur
  if (total > 12) {
    return (
      <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums px-1">
        {current + 1}/{total}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-[3px] px-1">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-label={`Aller à l'étape ${i + 1}`}
          className={cx(
            "rounded-full transition-all duration-200 focus-visible:outline-none",
            i === current
              ? "w-4 h-1.5 bg-indigo-600"
              : i < current
              ? "w-1.5 h-1.5 bg-emerald-400 dark:bg-emerald-500"
              : "w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const SPEEDS: Speed[] = [0.5, 1, 2, 3, 5, 10];

export default function GraphControls() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isRunning,
    isComputed,
    currentStepIndex,
    totalSteps,
    executeDantzig,
    resetResult,
    goToNextStep,
    goToPreviousStep,
    goToFirstStep,
    goToLastStep,
    setCurrentStepIndex,
    arrangeGraph,
    nodes,
  } = useGraphStore();

  const handleReset = () => {
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    resetResult();
    goToFirstStep();
  };

  const cycleSpeed = () => {
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  };

  const handlePlayPause = () => {
    if (!isComputed && !isRunning) executeDantzig();
    setIsPlaying((p) => !p);
  };

  const dispatch = (event: string) => window.dispatchEvent(new CustomEvent(event));

  // Auto-play
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const delay = 1000 / speed;
    timerRef.current = setInterval(() => {
      if (currentStepIndex >= totalSteps - 1) {
        setIsPlaying(false);
        return;
      }
      goToNextStep();
    }, delay);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, speed, currentStepIndex, totalSteps, goToNextStep]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;

      switch (e.key) {
        case " ":         e.preventDefault(); handlePlayPause(); break;
        case "ArrowRight": if (currentStepIndex < totalSteps - 1) goToNextStep(); break;
        case "ArrowLeft":  if (currentStepIndex > 0) goToPreviousStep(); break;
        case "r": case "R": handleReset(); break;
        case "s": case "S": cycleSpeed(); break;
        case "f": case "F": dispatch("graph-fit-view"); break;
        case "+": case "=": dispatch("graph-zoom-in"); break;
        case "-":            dispatch("graph-zoom-out"); break;
        case "Home": case "ArrowDown": goToFirstStep(); break;
        case "End": case "ArrowUp": goToLastStep(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentStepIndex, totalSteps, isComputed, isRunning, goToNextStep, goToPreviousStep, goToFirstStep, goToLastStep]);

  return (
    <>
      {/* Reset */}
      <IconButton tooltip="Réinitialiser (R)" variant="danger" onClick={handleReset}>
        {Icons.reset}
      </IconButton>

      <Sep />

      {/* First */}
      <IconButton tooltip="Première étape (Début)" onClick={goToFirstStep} disabled={currentStepIndex <= 0}>
        {Icons.first}
      </IconButton>

      {/* Prev */}
      <IconButton tooltip="Étape précédente (←)" onClick={goToPreviousStep} disabled={currentStepIndex <= 0}>
        {Icons.prev}
      </IconButton>

      {/* Play / Pause — bouton central mis en valeur */}
      <Tooltip label={isPlaying ? "Pause (Espace)" : "Lancer (Espace)"}>
        <button
          onClick={handlePlayPause}
          className={cx(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
            isPlaying
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
              : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700"
          )}
          aria-label={isPlaying ? "Pause" : "Lancer"}
        >
          {isPlaying ? Icons.pause : Icons.play}
        </button>
      </Tooltip>

      {/* Next */}
      <IconButton tooltip="Étape suivante (→)" onClick={goToNextStep} disabled={currentStepIndex >= totalSteps - 1}>
        {Icons.next}
      </IconButton>

      {/* Last */}
      <IconButton tooltip="Dernière étape (Fin)" onClick={goToLastStep} disabled={currentStepIndex >= totalSteps - 1}>
        {Icons.last}
      </IconButton>

      <Sep />

      {/* Step dots / counter */}
      <StepDots
        total={totalSteps}
        current={currentStepIndex}
        onChange={setCurrentStepIndex}
      />

      <Sep />

      {/* Speed */}
      <Tooltip label={`Vitesse : ${speed}× (S)`}>
        <button
          onClick={cycleSpeed}
          className={cx(
            "h-8 px-2 rounded-lg text-[11px] font-bold font-mono min-w-[36px] transition-all duration-150 active:scale-95",
            "text-slate-500 dark:text-slate-400",
            "hover:bg-slate-100 dark:hover:bg-slate-800",
            "hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          {speed}×
        </button>
      </Tooltip>

      <Sep />


      {/* View controls */}

      <IconButton tooltip="Réorganiser automatiquement (G)" onClick={arrangeGraph}>
        {Icons.generate}
      </IconButton>
      <IconButton tooltip="Ajuster la vue (F)" onClick={() => dispatch("graph-fit-view")}>
        {Icons.fit}
      </IconButton>
      <IconButton tooltip="Zoom avant (+)" onClick={() => dispatch("graph-zoom-in")}>
        {Icons.zoomIn}
      </IconButton>
      <IconButton tooltip="Zoom arrière (−)" onClick={() => dispatch("graph-zoom-out")}>
        {Icons.zoomOut}
      </IconButton>
    </>
  );
}
