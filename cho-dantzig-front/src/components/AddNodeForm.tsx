import { useState, useMemo, useEffect } from "react";
import { ALPHABET } from "../constants/graphConstants";
import type { GraphNode } from "../types/graph";

interface AddNodeFormProps {
  onAdd: (node: GraphNode) => void;
  onClose: () => void;
  existingNodes?: GraphNode[];
}

const CANVAS_WIDTH = 696;
const MARGIN = 40;
const spacing = 75;

export default function AddNodeForm({
  onAdd,
  onClose,
  existingNodes = [],
}: AddNodeFormProps) {
  const [mode, setMode] = useState<"count" | "range">("count");
  const [count, setCount] = useState(5);
  const [startLetter, setStartLetter] = useState<string | null>(null);
  const [endLetter, setEndLetter] = useState<string | null>(null);

  const existingLabels = useMemo(
    () => new Set(existingNodes.map((n) => n.label.toUpperCase())),
    [existingNodes]
  );

  const usedIdsBase = useMemo(
    () => new Set(existingNodes.map((n) => n.id.toLowerCase())),
    [existingNodes]
  );

  const maxPerRow = Math.max(
    1,
    Math.floor((CANVAS_WIDTH - 2 * MARGIN) / spacing)
  );

  const availableAlphabet = useMemo(
    () => ALPHABET.filter((l) => !existingLabels.has(l.toUpperCase())),
    [existingLabels]
  );

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const generateUniqueId = (base: string, local: Set<string>) => {
    let id = base.toLowerCase();
    let i = 1;

    while (local.has(id)) {
      id = `${base.toLowerCase()}_${i}`;
      i++;
    }

    local.add(id);
    return id;
  };

  const rangeLetters = useMemo(() => {
    if (!startLetter || !endLetter) return [];

    const a = ALPHABET.indexOf(startLetter);
    const b = ALPHABET.indexOf(endLetter);

    const from = Math.min(a, b);
    const to = Math.max(a, b);

    return ALPHABET.slice(from, to + 1).filter(
      (l) => !existingLabels.has(l.toUpperCase())
    );
  }, [startLetter, endLetter, existingLabels]);

  useEffect(() => {
    setStartLetter(null);
    setEndLetter(null);
  }, [mode]);

  const handleLetterClick = (letter: string) => {
    if (existingLabels.has(letter.toUpperCase())) return;

    if (!startLetter || endLetter) {
      setStartLetter(letter);
      setEndLetter(null);
    } else {
      setEndLetter(letter);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const localIds = new Set(usedIdsBase);
    let letters: string[] = [];

    if (mode === "count") {
      const safe = Math.min(Math.max(count, 1), availableAlphabet.length);
      letters = availableAlphabet.slice(0, safe);
    }

    if (mode === "range") {
      letters = rangeLetters;
    }

    letters.forEach((label, i) => {
      const col = i % maxPerRow;
      const row = Math.floor(i / maxPerRow);

      onAdd({
        id: generateUniqueId(label, localIds),
        label,
        x: clamp(80 + col * spacing, MARGIN, CANVAS_WIDTH - MARGIN),
        y: clamp(80 + row * spacing, MARGIN, 500),
        type: "normal",
      });
    });

    onClose();
  };

  const isActive = (letter: string) =>
    letter === startLetter || letter === endLetter;

  const isInRange = (letter: string) =>
    startLetter &&
    endLetter &&
    rangeLetters.includes(letter);

  const getLetterStyle = (letter: string) => {
    const disabled = existingLabels.has(letter.toUpperCase());

    if (disabled)
      return "opacity-30 cursor-not-allowed line-through bg-slate-100 dark:bg-slate-900";

    if (isActive(letter))
      return "bg-indigo-500 text-white scale-110 shadow-md";

    if (isInRange(letter))
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300";

    return "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700";
  };

  return (
    <div className="w-full max-w-md text-slate-800 dark:text-slate-100">

      {/* HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold tracking-wide">
            Générateur de sommets
          </h2>
          <span className="text-[10px] text-slate-400">
            {existingNodes.length} nœuds existants
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-3">

        {/* MODE SWITCH */}
        <div className="relative flex bg-slate-200 dark:bg-slate-900 p-1 rounded-xl">
          <div
            className={`absolute top-1 bottom-1 w-1/2 rounded-lg bg-white dark:bg-slate-800 transition-transform duration-200 ${
              mode === "range" ? "translate-x-full" : ""
            }`}
          />
          <button
            type="button"
            onClick={() => setMode("count")}
            className="relative z-10 flex-1 text-xs py-1"
          >
            Quantité
          </button>
          <button
            type="button"
            onClick={() => setMode("range")}
            className="relative z-10 flex-1 text-xs py-1"
          >
            Plage
          </button>
        </div>

        {/* COUNT */}
        {mode === "count" && (
          <div className="space-y-2">
            <label className="text-xs text-slate-500">
              Nombre de sommets
            </label>

            <input
              type="number"
              value={count}
              min={1}
              max={availableAlphabet.length}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-28 px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />

            <p className="text-[10px] text-slate-400">
              {availableAlphabet.length} lettres disponibles
            </p>
          </div>
        )}

        {/* RANGE */}
        {mode === "range" && (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 max-h-36 overflow-y-auto">
              {ALPHABET.map((letter) => {
                const disabled = existingLabels.has(letter.toUpperCase());

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleLetterClick(letter)}
                    className={`text-xs py-1 rounded-md transition-all active:scale-95 ${getLetterStyle(
                      letter
                    )}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Début: {startLetter ?? "-"}</span>
              <span>Fin: {endLetter ?? "-"}</span>
              <span>{rangeLetters.length} nœuds</span>
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-xs py-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:opacity-80"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={
              (mode === "range" && (!startLetter || !endLetter)) ||
              (mode === "count" && availableAlphabet.length === 0)
            }
            className="flex-1 text-xs py-2 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40"
          >
            Générer
          </button>
        </div>
      </form>
    </div>
  );
}