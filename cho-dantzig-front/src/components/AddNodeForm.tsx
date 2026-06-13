import { useState, useMemo, useEffect } from "react";
import { ALPHABET } from "../constants/graphConstants";
import type { GraphNode } from "../types/graph";

interface AddNodeFormProps {
  onAdd: (node: GraphNode) => void;
  onClose: () => void;
  existingNodes?: GraphNode[];
  theme?: "light" | "dark"; // Nouvelle prop reçue du parent
}

const CANVAS_WIDTH = 696;
const MARGIN = 40;
const spacing = 75;

export default function AddNodeForm({
  onAdd,
  onClose,
  existingNodes = [],
  theme = "light", // Mode clair par défaut si non spécifié
}: AddNodeFormProps) {
  const [mode, setMode] = useState<"count" | "range">("count");
  const [count, setCount] = useState(5);
  const [startLetter, setStartLetter] = useState<string | null>(null);
  const [endLetter, setEndLetter] = useState<string | null>(null);

  const isDark = theme === "dark";

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
    startLetter && endLetter && rangeLetters.includes(letter);

  const getLetterStyle = (letter: string) => {
    const disabled = existingLabels.has(letter.toUpperCase());
    if (disabled) {
      return isDark
        ? "opacity-25 cursor-not-allowed line-through bg-slate-900 text-slate-600"
        : "opacity-40 cursor-not-allowed line-through bg-slate-100 text-slate-400 border border-slate-200/50";
    }
    if (isActive(letter)) {
      return "bg-indigo-600 text-white scale-105 shadow-md shadow-indigo-600/20 font-bold z-10";
    }
    if (isInRange(letter)) {
      return isDark
        ? "bg-indigo-500/10 text-indigo-300 font-semibold"
        : "bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100";
    }
    return isDark
      ? "bg-slate-800 border border-transparent hover:bg-slate-700 text-slate-200"
      : "bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700";
  };

  return (
    <div className={`w-full max-w-lg p-6 rounded-2xl shadow-xl transition-colors duration-200 ${
      isDark 
        ? "text-slate-100 bg-slate-900 border border-white/10" 
        : "text-slate-900 bg-white border border-slate-200/60"
    }`}>
      
      {/* HEADER */}
      <div className={`flex items-center justify-between pb-4 border-b ${
        isDark ? "border-slate-800" : "border-slate-100"
      }`}>
        <div className="space-y-1">
          <h2 className={`text-base font-bold tracking-wide ${isDark ? "text-slate-100" : "text-slate-800"}`}>
            Générateur de sommets
          </h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
            isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
          }`}>
            {existingNodes.length} nœuds existants
          </span>
        </div>
        <button
          onClick={onClose}
          type="button"
          className={`w-8 h-8 rounded-xl flex items-center justify-center border text-slate-400 transition-colors duration-200 ${
            isDark 
              ? "border-white/5 hover:text-slate-200 hover:bg-slate-800" 
              : "border-slate-200 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pt-5">
        
        {/* MODE SWITCH */}
        <div className={`relative flex p-1 rounded-xl border ${
          isDark ? "bg-slate-950 border-transparent" : "bg-slate-100 border-slate-200/60"
        }`}>
          <div
            className={`absolute top-1 bottom-1 w-[49%] rounded-lg shadow-sm transition-transform duration-200 ease-out ${
              isDark ? "bg-slate-800" : "bg-white"
            } ${mode === "range" ? "translate-x-[102%]" : ""}`}
          />
          <button
            type="button"
            onClick={() => setMode("count")}
            className={`relative z-10 flex-1 text-xs font-semibold py-2 rounded-lg transition-colors duration-200 ${
              mode === "count" 
                ? isDark ? "text-white" : "text-indigo-600" 
                : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Par Quantité
          </button>
          <button
            type="button"
            onClick={() => setMode("range")}
            className={`relative z-10 flex-1 text-xs font-semibold py-2 rounded-lg transition-colors duration-200 ${
              mode === "range" 
                ? isDark ? "text-white" : "text-indigo-600" 
                : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Par Plage de lettres
          </button>
        </div>

        {/* CONTENU DU MODE : COUNT */}
        {mode === "count" && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Nombre de sommets à générer
              </label>
              <input
                type="number"
                value={count}
                min={1}
                max={availableAlphabet.length}
                onChange={(e) => setCount(Number(e.target.value))}
                className={`w-32 px-3 py-2 text-sm font-medium rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  isDark 
                    ? "border-slate-800 bg-slate-950 text-slate-100" 
                    : "border-slate-200 bg-white text-slate-800"
                }`}
              />
            </div>
            <p className={`text-[11px] flex items-center gap-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {availableAlphabet.length} lettres disponibles restantes dans l'alphabet.
            </p>
          </div>
        )}

        {/* CONTENU DU MODE : RANGE */}
        {mode === "range" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Sélectionnez la lettre de début et de fin
              </label>
              <div className={`grid grid-cols-6 gap-2 p-3 rounded-xl border max-h-48 overflow-y-auto ${
                isDark ? "border-transparent bg-slate-950" : "border-slate-200/60 bg-slate-50/50"
              }`}>
                {ALPHABET.map((letter) => {
                  const disabled = existingLabels.has(letter.toUpperCase());
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleLetterClick(letter)}
                      className={`text-xs font-semibold py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center ${getLetterStyle(
                        letter
                      )}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BARRE D'ÉTAT DE LA PLAGE */}
            <div className={`grid grid-cols-3 gap-2 px-3 py-2.5 rounded-xl text-center text-[11px] font-medium border ${
              isDark 
                ? "bg-slate-800/40 text-slate-400 border-slate-700/50" 
                : "bg-slate-50 text-slate-600 border-slate-200/60"
            }`}>
              <div>Début : <span className={`font-bold ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{startLetter ?? "-"}</span></div>
              <div className={`border-x ${isDark ? "border-slate-700" : "border-slate-200"}`}>Fin : <span className={`font-bold ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{endLetter ?? "-"}</span></div>
              <div>Sélection : <span className={`font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{rangeLetters.length} nœuds</span></div>
            </div>
          </div>
        )}

        {/* ACTIONS FOOTER */}
        <div className={`flex gap-3 pt-4 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 text-xs font-semibold py-2.5 rounded-xl border transition-colors duration-150 ${
              isDark 
                ? "border-white/5 text-slate-300 bg-slate-800 hover:bg-slate-700" 
                : "border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
            }`}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={
              (mode === "range" && (!startLetter || !endLetter)) ||
              (mode === "count" && availableAlphabet.length === 0)
            }
            className="flex-1 text-xs font-semibold py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/10 active:scale-[0.99] transition-all duration-150"
          >
            Générer les sommets
          </button>
        </div>
      </form>
    </div>
  );
}