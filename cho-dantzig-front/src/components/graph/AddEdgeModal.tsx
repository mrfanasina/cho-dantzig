import { useState } from "react";

type AddEdgeModalProps = {
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;

  onClose: () => void;

  onCreate: (edge: {
    id: string;
    from: string;
    to: string;
    weight: number;
    flow: number;
  }) => void;
};

export default function AddEdgeModal({
  fromLabel,
  toLabel,
  from,
  to,
  onClose,
  onCreate,
}: AddEdgeModalProps) {
  const [weight, setWeight] = useState("1");
  const [flow, setFlow] = useState("0");

  const handleSubmit = () => {
    onCreate({
      id: `e-${Date.now()}`,
      from,
      to,
      weight: Number(weight),
      flow: Number(flow),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            Créer un arc
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Configurez la liaison entre les deux nœuds.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Preview */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold">
                {fromLabel}
              </div>

              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-12 h-px bg-slate-300" />
                <span>→</span>
                <div className="w-12 h-px bg-slate-300" />
              </div>

              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                {toLabel}
              </div>
            </div>
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Poids
            </label>

            <input
              type="number"
              min="1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="
                w-full
                px-3 py-2.5
                border border-slate-300
                rounded-xl
                focus:ring-2
                focus:ring-blue-500
                focus:border-blue-500
                outline-none
              "
            />
          </div>

          {/* Flow */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Flux initial
            </label>

            <input
              type="number"
              value={flow}
              onChange={(e) => setFlow(e.target.value)}
              className="
                w-full
                px-3 py-2.5
                border border-slate-300
                rounded-xl
                focus:ring-2
                focus:ring-blue-500
                focus:border-blue-500
                outline-none
              "
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="
              px-4 py-2
              rounded-xl
              border border-slate-300
              text-slate-600
              hover:bg-slate-50
            "
          >
            Annuler
          </button>

          <button
            onClick={handleSubmit}
            className="
              px-5 py-2
              rounded-xl
              bg-blue-600
              text-white
              font-medium
              hover:bg-blue-700
              shadow-sm
            "
          >
            Créer l'arc
          </button>
        </div>
      </div>
    </div>
  );
}