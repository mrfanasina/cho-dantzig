// components/graph/StepsPanel.tsx
import { useState } from "react";

type StepStatus = "done" | "active" | "pending";

interface Step {
  id: number;
  status: StepStatus;
  title: string;
  description: string;
  detail: string | null;
  value: number | null;
}

interface StatusConfig {
  dot: string;
  ring: string;
  badge: string;
  line: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: 1,
    status: "done",
    title: "Initialisation",
    description: "Définition du graphe avec 6 nœuds et 7 arêtes pondérées.",
    detail: "Nœud source : S — Nœud puits : T",
    value: null,
  },
  {
    id: 2,
    status: "done",
    title: "Chemin augmentant #1",
    description: "Chemin S → A → C → T trouvé via BFS.",
    detail: "Capacité résiduelle : min(4, 2, 3) = 2",
    value: 2,
  },
  {
    id: 3,
    status: "done",
    title: "Mise à jour du résidu",
    description: "Mise à jour des capacités résiduelles sur S→A, A→C, C→T.",
    detail: "Arêtes inverses créées.",
    value: null,
  },
  {
    id: 4,
    status: "active",
    title: "Chemin augmentant #2",
    description: "Recherche en cours via S → B → D → T.",
    detail: "Capacité résiduelle estimée : min(3, 6, 4) = 3",
    value: 3,
  },
  {
    id: 5,
    status: "pending",
    title: "Chemin augmentant #3",
    description: "À explorer : S → A → D → T.",
    detail: null,
    value: null,
  },
  {
    id: 6,
    status: "pending",
    title: "Terminaison",
    description: "Aucun chemin augmentant restant.",
    detail: "Flot maximum calculé.",
    value: null,
  },
];

const STATUS_CONFIG: Record<StepStatus, StatusConfig> = {
  done: {
    dot: "bg-emerald-400",
    ring: "ring-emerald-100",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    line: "bg-emerald-200",
    icon: (
      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
        <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  active: {
    dot: "bg-blue-500",
    ring: "ring-blue-100",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    line: "bg-slate-100",
    icon: <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse block" />,
  },
  pending: {
    dot: "bg-slate-200",
    ring: "ring-slate-100",
    badge: "bg-slate-50 text-slate-400 border-slate-200",
    line: "bg-slate-100",
    icon: <span className="w-2 h-2 rounded-full bg-slate-300 block" />,
  },
};

export default function StepsPanel() {
  const [expanded, setExpanded] = useState<number | null>(4);

  const totalFlow = STEPS.filter((s) => s.status === "done" && s.value !== null).reduce(
    (acc, s) => acc + (s.value ?? 0),
    0
  );

  return (
    <div className="p-4 flex flex-col gap-1">
      <div className="mb-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-lg shadow-blue-200">
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1">Flot courant</p>
        <p className="text-3xl font-bold font-mono">{totalFlow}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/80 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (totalFlow / 7) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] opacity-60 font-mono">/ ~7 max</span>
        </div>
      </div>

      <div className="relative">
        {STEPS.map((step, i) => {
          const cfg = STATUS_CONFIG[step.status];
          const isExp = expanded === step.id;
          const isLast = i === STEPS.length - 1;

          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ring-4 ${cfg.ring} ${cfg.dot} shrink-0 transition-all duration-200`}>
                  {cfg.icon}
                </div>
                {!isLast && <div className={`w-[2px] flex-1 min-h-[20px] mt-1 mb-1 ${cfg.line} rounded-full`} />}
              </div>

              <div
                className="flex-1 pb-3 cursor-pointer"
                onClick={() => setExpanded(isExp ? null : step.id)}
              >
                <div className={`rounded-xl border transition-all duration-200 ${
                  step.status === "active"
                    ? "border-blue-200 bg-blue-50/50 shadow-sm"
                    : step.status === "done"
                    ? "border-transparent hover:border-slate-100 hover:bg-slate-50/50"
                    : "border-transparent opacity-50"
                } p-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        #{String(step.id).padStart(2, "0")}
                      </span>
                      <span className={`text-[11px] font-semibold truncate ${
                        step.status === "pending" ? "text-slate-400" : "text-slate-700"
                      }`}>
                        {step.title}
                      </span>
                    </div>
                    {step.value !== null && (
                      <span className={`shrink-0 text-[10px] font-bold font-mono border rounded-md px-1.5 py-0.5 ${cfg.badge}`}>
                        +{step.value}
                      </span>
                    )}
                  </div>

                  <p className={`text-[11px] mt-1 leading-relaxed ${
                    step.status === "pending" ? "text-slate-300" : "text-slate-500"
                  }`}>
                    {step.description}
                  </p>

                  {isExp && step.detail && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-mono text-slate-400 leading-relaxed">{step.detail}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          Complété
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          En cours
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />
          En attente
        </span>
      </div>
    </div>
  );
}
