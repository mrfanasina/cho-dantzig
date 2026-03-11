// components/graph/GraphControls.tsx
import { useState } from "react";

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
const TOTAL_STEPS = 6;

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

function IconButton({ onClick, active = false, disabled = false, tooltip, children, variant = "default" }: IconButtonProps) {
  const base =
    "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed";

  const variantClass: Record<ButtonVariant, string> = {
    default: active
      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
    danger: "text-red-400 hover:bg-red-50 hover:text-red-600",
    success: "text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700",
  };

  return (
    <Tooltip label={tooltip}>
      <button className={`${base} ${variantClass[variant]}`} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    </Tooltip>
  );
}

export default function GraphControls() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [step, setStep] = useState<number>(2);

  const handleReset = () => {
    setStep(0);
    setIsPlaying(false);
  };

  const cycleSpeed = () => {
    const nextIndex = (SPEEDS.indexOf(speed) + 1) % SPEEDS.length;
    setSpeed(SPEEDS[nextIndex]);
  };

  return (
    <>
      <IconButton tooltip="Réinitialiser" variant="danger" onClick={handleReset}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M2 8a6 6 0 1 1 1.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M2 12V8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

      <IconButton tooltip="Étape précédente" disabled={step <= 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <IconButton tooltip={isPlaying ? "Pause" : "Lancer"} active={isPlaying} onClick={() => setIsPlaying((p) => !p)}>
        {isPlaying ? (
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
            <rect x="3" y="3" width="4" height="10" rx="1.5" />
            <rect x="9" y="3" width="4" height="10" rx="1.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
            <path d="M5 3.5l8 4.5-8 4.5V3.5z" />
          </svg>
        )}
      </IconButton>

      <IconButton tooltip="Étape suivante" disabled={step >= TOTAL_STEPS} onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

      <div className="flex items-center gap-1 px-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i + 1)}
            className={`rounded-full transition-all duration-200 ${
              i + 1 === step
                ? "w-4 h-2 bg-blue-600"
                : i + 1 < step
                ? "w-2 h-2 bg-emerald-400"
                : "w-2 h-2 bg-slate-200 hover:bg-slate-300"
            }`}
          />
        ))}
      </div>

      <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

      <Tooltip label={`Vitesse : ${speed}x`}>
        <button
          className="h-9 px-2.5 rounded-xl text-[11px] font-bold font-mono text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-150 active:scale-95 min-w-[40px]"
          onClick={cycleSpeed}
        >
          {speed}x
        </button>
      </Tooltip>

      <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

      <IconButton tooltip="Ajuster la vue" onClick={() => {}}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <IconButton tooltip="Zoom +" onClick={() => {}}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5l3 3M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </IconButton>

      <IconButton tooltip="Zoom -" onClick={() => {}}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5l3 3M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </IconButton>
    </>
  );
}
