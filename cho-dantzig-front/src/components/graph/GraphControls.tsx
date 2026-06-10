// components/graph/GraphControls.tsx
import { useEffect, useRef, useState } from "react";
import { useGraphStore } from "../../store/graphStore";

type Speed = 0.5 | 1 | 2;
type ButtonVariant = "default" | "danger" | "success";

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

interface IconButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
}

const SPEEDS: Speed[] = [0.5, 1, 2];

function Tooltip({ label, children }: TooltipProps) {
  return (
    <div className="relative group/tip flex items-center">
      {children}

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none shadow-lg">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  active = false,
  disabled = false,
  tooltip,
  children,
  variant = "default",
}: IconButtonProps) {
  const base =
    "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed";

  const variantClass: Record<ButtonVariant, string> = {
    default: active
      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",

    danger:
      "text-red-400 hover:bg-red-50 hover:text-red-600",

    success:
      "text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700",
  };

  return (
    <Tooltip label={tooltip}>
      <button
        className={`${base} ${variantClass[variant]}`}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    </Tooltip>
  );
}

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
  } = useGraphStore();

  const handleReset = () => {
    setIsPlaying(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    resetResult();
    goToFirstStep();
  };

  const cycleSpeed = () => {
    const nextIndex =
      (SPEEDS.indexOf(speed) + 1) % SPEEDS.length;

    setSpeed(SPEEDS[nextIndex]);
  };

  // Lecture automatique
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
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

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [
    isPlaying,
    speed,
    currentStepIndex,
    totalSteps,
    goToNextStep,
  ]);

  return (
    <>
      {/* RESET */}

      <IconButton
        tooltip="Réinitialiser"
        variant="danger"
        onClick={handleReset}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path
            d="M2 8a6 6 0 1 1 1.5 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M2 12V8h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>

      <div className="flex items-center">
  <div className="w-px h-5 bg-slate-200" />
</div>

      {/* PREVIOUS */}

      <IconButton
        tooltip="Étape précédente"
        disabled={currentStepIndex <= 0}
        onClick={goToPreviousStep}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path
            d="M10 4L6 8l4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>

      {/* PLAY / PAUSE */}

      <IconButton
        tooltip={isPlaying ? "Pause" : "Lancer"}
        active={isPlaying}
        onClick={() => {
          if (!isComputed && !isRunning) {
            executeDantzig();
          }

          setIsPlaying((p) => !p);
        }}
      >
        {isPlaying ? (
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="currentColor"
          >
            <rect x="3" y="3" width="4" height="10" rx="1.5" />
            <rect x="9" y="3" width="4" height="10" rx="1.5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="currentColor"
          >
            <path d="M5 3.5l8 4.5-8 4.5V3.5z" />
          </svg>
        )}
      </IconButton>

      {/* NEXT */}

      <IconButton
        tooltip="Étape suivante"
        disabled={currentStepIndex >= totalSteps - 1}
        onClick={goToNextStep}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>

      <div className="flex items-center">
        <div className="w-px h-5 bg-slate-200" />
      </div>

      {/* STEP INDICATORS */}

      <div className="flex items-center gap-1 px-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStepIndex(i)}
            className={`rounded-full transition-all duration-200 ${
              i === currentStepIndex
                ? "w-4 h-2 bg-blue-600"
                : i < currentStepIndex
                ? "w-2 h-2 bg-emerald-400"
                : "w-2 h-2 bg-slate-200 hover:bg-slate-300"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center">
        <div className="w-px h-5 bg-slate-200" />
      </div>

      {/* SPEED */}

      <Tooltip label={`Vitesse : ${speed}x`}>
        <button
          className="h-9 px-2.5 rounded-xl text-[11px] font-bold font-mono text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-150 active:scale-95 min-w-[40px]"
          onClick={cycleSpeed}
        >
          {speed}x
        </button>
      </Tooltip>

      <div className="flex items-center">
        <div className="w-px h-5 bg-slate-200" />
      </div>

      {/* FIRST STEP */}

      <IconButton
        tooltip="Première étape"
        onClick={goToFirstStep}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M3 4v8M6 12l4-4-4-4M11 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      {/* LAST STEP */}

      <IconButton
        tooltip="Dernière étape"
        onClick={goToLastStep}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M13 4v8M10 12l-4-4 4-4M5 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      {/* FIT VIEW */}

      <IconButton
        tooltip="Ajuster la vue"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent("graph-fit-view")
          );
        }}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path
            d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>

      {/* ZOOM + */}

      <IconButton
        tooltip="Zoom +"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent("graph-zoom-in")
          );
        }}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <circle
            cx="7"
            cy="7"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10.5 10.5l3 3M7 5v4M5 7h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </IconButton>

      {/* ZOOM - */}

      <IconButton
        tooltip="Zoom -"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent("graph-zoom-out")
          );
        }}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <circle
            cx="7"
            cy="7"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10.5 10.5l3 3M5 7h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </IconButton>
    </>
  );
}