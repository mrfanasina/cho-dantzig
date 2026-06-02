import { useGraphStore } from "../../store/graphStore";

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

  const hasPrevious = currentStepIndex > 0;
  const hasNext = isComputed && currentStepIndex < totalSteps - 1;

  return (
    <>
      <IconButton tooltip="Exécuter l'algorithme" variant="success" disabled={isRunning || isComputed} onClick={executeDantzig}>
        {isRunning ? (
          <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
            <path d="M3 3v10l10-5-10-5z" fill="currentColor" />
          </svg>
        )}
      </IconButton>

      <IconButton tooltip="Réinitialiser" variant="danger" disabled={isRunning} onClick={resetResult}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M2 8a6 6 0 1 1 1.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M2 12V8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

      <IconButton tooltip="Première étape" disabled={!hasPrevious || isRunning} onClick={goToFirstStep}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M3 4v8M6 12l4-4-4-4M11 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <IconButton tooltip="Étape précédente" disabled={!hasPrevious || isRunning} onClick={goToPreviousStep}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <IconButton tooltip="Étape suivante" disabled={!hasNext || isRunning} onClick={goToNextStep}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <IconButton tooltip="Dernière étape" disabled={!hasNext || isRunning} onClick={goToLastStep}>
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M13 4v8M10 12l-4-4 4-4M5 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      {isComputed && (
        <>
          <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

          <div className="flex items-center gap-1 px-2">
            {Array.from({ length: Math.min(totalSteps, 10) }).map((_, i) => {
              const stepIndex = totalSteps > 10 ? Math.round((i / 9) * (totalSteps - 1)) : i;
              const isActive = stepIndex === currentStepIndex;
              const isPast = stepIndex < currentStepIndex;

              return (
                <button
                  key={stepIndex}
                  onClick={() => setCurrentStepIndex(stepIndex)}
                  className={`rounded-full transition-all duration-200 ${
                    isActive
                      ? "w-4 h-2 bg-blue-600"
                      : isPast
                      ? "w-2 h-2 bg-emerald-400"
                      : "w-2 h-2 bg-slate-200 hover:bg-slate-300"
                  }`}
                />
              );
            })}
          </div>

          <div className="text-[10px] font-mono text-slate-500 ml-1">
            {currentStepIndex + 1}/{totalSteps}
          </div>
        </>
      )}
    </>
  );
}
