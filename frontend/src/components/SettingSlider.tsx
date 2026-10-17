"use client";

import { useEffect, useRef, useState } from "react";

const ACCENTS = {
  rose: { slider: "accent-rose-500", input: "focus:border-rose-500/50" },
  emerald: { slider: "accent-emerald-500", input: "focus:border-emerald-500/50" },
  blue: { slider: "accent-blue-500", input: "focus:border-blue-500/50" },
  purple: { slider: "accent-purple-500", input: "focus:border-purple-500/50" },
};

// How long to wait after the last change before syncing to the room
const COMMIT_DELAY_MS = 400;

interface SettingSliderProps {
  label: string;
  value: number;
  min: number;
  sliderMax: number;
  inputMax: number;
  unit: string;
  accent: keyof typeof ACCENTS;
  onCommit: (value: number) => void;
}

// Slider + number input that keeps a local draft while the user drags or types,
// and only sends the final value to the room (instead of one update per step).
export function SettingSlider({ label, value, min, sliderMax, inputMax, unit, accent, onCommit }: SettingSliderProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shown = draft ?? value;

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const commit = (next: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setDraft(null);
    if (next !== value) onCommit(next);
  };

  const change = (next: number) => {
    setDraft(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => commit(next), COMMIT_DELAY_MS);
  };

  const flush = () => {
    if (draft !== null) commit(draft);
  };

  return (
    <div>
      <label className="block text-sm text-white/60 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={Math.max(sliderMax, shown)}
          value={shown}
          onChange={(e) => change(Number(e.target.value))}
          onPointerUp={flush}
          onKeyUp={flush}
          className={`flex-1 ${ACCENTS[accent].slider}`}
        />
        <input
          type="number"
          min={min}
          max={inputMax}
          value={shown}
          onChange={(e) => change(Math.max(min, Math.min(inputMax, Number(e.target.value) || min)))}
          onBlur={flush}
          onKeyDown={(e) => {
            if (e.key === "Enter") flush();
          }}
          className={`w-16 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-center font-mono text-sm focus:outline-none ${ACCENTS[accent].input} no-spinner`}
        />
        <span className="text-white/60 text-sm">{unit}</span>
      </div>
    </div>
  );
}
