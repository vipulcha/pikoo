"use client";

import { useEffect, useRef, useState } from "react";
import { Phase, MAX_ADD_TIME_SEC } from "@/lib/types";

interface AddTimeButtonsProps {
  phase: Phase;
  onAdd: (seconds: number) => void;
  disabled?: boolean;
}

const MAX_MINUTES = MAX_ADD_TIME_SEC / 60;

export function AddTimeButtons({ phase, onAdd, disabled = false }: AddTimeButtonsProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customOpen) inputRef.current?.focus();
  }, [customOpen]);

  const accent = {
    focus: "hover:bg-rose-500/20 hover:border-rose-500/50 focus-visible:border-rose-500/60",
    break: "hover:bg-emerald-500/20 hover:border-emerald-500/50 focus-visible:border-emerald-500/60",
    long_break: "hover:bg-blue-500/20 hover:border-blue-500/50 focus-visible:border-blue-500/60",
  }[phase];

  const pill = `h-9 px-3.5 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm text-sm text-white/80
    transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none outline-none ${accent}`;

  const minutes = Number(value);
  const valid = Number.isFinite(minutes) && minutes > 0 && minutes <= MAX_MINUTES;

  const closeCustom = () => {
    setCustomOpen(false);
    setValue("");
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onAdd(Math.round(minutes * 60));
    closeCustom();
  };

  return (
    <div className="mt-5 flex items-center justify-center gap-2">
      <button type="button" disabled={disabled} onClick={() => onAdd(5 * 60)} className={pill} title="Add 5 minutes">
        +5 min
      </button>
      <button type="button" disabled={disabled} onClick={() => onAdd(10 * 60)} className={pill} title="Add 10 minutes">
        +10 min
      </button>

      {customOpen ? (
        <form onSubmit={submitCustom} className="flex items-center gap-1.5">
          <div className={`flex items-center h-9 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm pl-3.5 pr-1 ${accent}`}>
            <span className="text-sm text-white/50">+</span>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min={0.5}
              max={MAX_MINUTES}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") closeCustom(); }}
              placeholder="min"
              aria-label="Minutes to add"
              className="w-14 bg-transparent text-sm text-white text-center outline-none placeholder:text-white/30
                [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="submit"
              disabled={!valid || disabled}
              className="h-7 px-3 rounded-full bg-white/15 text-sm text-white hover:bg-white/25 disabled:opacity-30 transition-colors"
            >
              Add
            </button>
          </div>
          <button
            type="button"
            onClick={closeCustom}
            className="h-9 w-9 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cancel"
          >
            ✕
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCustomOpen(true)}
          className={pill}
          title="Add a custom amount"
          aria-label="Add a custom amount of time"
        >
          + Custom
        </button>
      )}
    </div>
  );
}
