import { useState } from "react";
import { ALPHABET } from "../constants/graphConstants";
import type { GraphNode } from "../types/graph";

interface AddNodeFormProps {
  onAdd: (node: GraphNode) => void;
  onClose: () => void;
  existingNodes?: GraphNode[];
}

const CANVAS_WIDTH = 696;
const CANVAS_HEIGHT = 494;
const MARGIN = 40;

export default function AddNodeForm({
  onAdd,
  onClose,
  existingNodes = [],
}: AddNodeFormProps) {
  const [mode, setMode] = useState<"count" | "range">("count");

  // COUNT MODE
  const [count, setCount] = useState(5);

  // RANGE MODE
  const [startLetter, setStartLetter] = useState<string | null>(null);
  const [endLetter, setEndLetter] = useState<string | null>(null);

  // POSITION (UNIQUEMENT MODE COUNT)
  const [startX, setStartX] = useState(200);
  const [startY, setStartY] = useState(200);
  const [spacing, setSpacing] = useState(80);

  const usedIds = new Set(existingNodes.map(n => n.id));

  const generateUniqueId = (base: string) => {
    let id = base.toLowerCase();
    let index = 1;

    while (usedIds.has(id)) {
      id = `${base.toLowerCase()}_${index}`;
      index++;
    }

    usedIds.add(id);
    return id;
  };

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const getRangeLetters = () => {
    if (!startLetter || !endLetter) return [];

    const startIndex = ALPHABET.indexOf(startLetter);
    const endIndex = ALPHABET.indexOf(endLetter);

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);

    return ALPHABET.slice(from, to + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const maxPerRow = Math.max(
      1,
      Math.floor((CANVAS_WIDTH - 2 * MARGIN) / spacing)
    );

    let letters: string[] = [];

    if (mode === "count") {
      const safeCount = Math.min(Math.max(count, 1), 26);
      letters = ALPHABET.slice(0, safeCount);
    }

    if (mode === "range") {
      letters = getRangeLetters();
    }

    letters.forEach((label, i) => {
      const id = generateUniqueId(label);

      const col = i % maxPerRow;
      const row = Math.floor(i / maxPerRow);

      const node: GraphNode = {
        id,
        label,
        x: clamp(startX + col * spacing, MARGIN, CANVAS_WIDTH - MARGIN),
        y: clamp(startY + row * spacing, MARGIN, CANVAS_HEIGHT - MARGIN),
        type: "normal",
      };

      onAdd(node);
    });

    onClose();
  };

  const handleLetterClick = (letter: string) => {
    if (!startLetter || (startLetter && endLetter)) {
      setStartLetter(letter);
      setEndLetter(null);
      return;
    }

    setEndLetter(letter);
  };

  const getLetterClass = (letter: string) => {
    if (letter === startLetter || letter === endLetter) {
      return "bg-blue-500 text-white";
    }

    if (startLetter && endLetter) {
      const range = getRangeLetters();
      if (range.includes(letter)) {
        return "bg-blue-100 text-blue-700";
      }
    }

    return "bg-slate-100 hover:bg-slate-200";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-700">
            Ajouter des nœuds
          </h2>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">

          {/* MODE SWITCH */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === "count"}
                onChange={() => setMode("count")}
              />
              Nombre
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === "range"}
                onChange={() => setMode("range")}
              />
              A → Z
            </label>
          </div>

          {/* COUNT MODE */}
          {mode === "count" && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Nombre de nœuds
                </label>
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>

              {/* POSITION ONLY HERE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">
                    Position X
                  </label>
                  <input
                    type="number"
                    value={startX}
                    onChange={(e) => setStartX(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-600">
                    Position Y
                  </label>
                  <input
                    type="number"
                    value={startY}
                    onChange={(e) => setStartY(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Espacement
                </label>
                <input
                  type="number"
                  min={20}
                  value={spacing}
                  onChange={(e) => setSpacing(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
            </>
          )}

          {/* RANGE MODE */}
          {mode === "range" && (
            <div>
              <label className="mb-2 block text-sm text-slate-600">
                Choisir une plage (clic début puis fin)
              </label>

              <div className="grid grid-cols-6 gap-2">
                {ALPHABET.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleLetterClick(letter)}
                    className={`rounded-lg px-2 py-2 text-sm transition ${getLetterClass(letter)}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Début : {startLetter ?? "-"} | Fin : {endLetter ?? "-"}
              </div>
            </div>
          )}

          {/* INFO */}
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Zone canvas : {CANVAS_WIDTH} × {CANVAS_HEIGHT}
          </div>

          {/* ACTIONS */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-700"
            >
              Annuler
            </button>

            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
              disabled={mode === "range" && (!startLetter || !endLetter)}
            >
              Générer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}