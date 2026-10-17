"use client";

import { useEffect } from "react";
import { Phase } from "@/lib/types";

interface ControlsProps {
  running: boolean;
  phase: Phase;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function Controls({ running, phase, onStart, onPause, onReset, onSkip, disabled = false }: ControlsProps) {
  // Keyboard shortcuts: Space = start/pause, R = reset, S = skip
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (e.code === "Space") {
        // A focused button already handles Space natively
        if (target?.closest("button, a")) return;
        e.preventDefault();
        if (running) onPause(); else onStart();
      } else if (e.key === "r" || e.key === "R") {
        onReset();
      } else if (e.key === "s" || e.key === "S") {
        onSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, running, onStart, onPause, onReset, onSkip]);

  const accentColor = {
    focus: "hover:bg-rose-500/20 hover:border-rose-500/50 active:bg-rose-500/30",
    break: "hover:bg-emerald-500/20 hover:border-emerald-500/50 active:bg-emerald-500/30",
    long_break: "hover:bg-blue-500/20 hover:border-blue-500/50 active:bg-blue-500/30",
  }[phase];

  const primaryColor = {
    focus: "bg-rose-500 hover:bg-rose-400 active:bg-rose-600",
    break: "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600",
    long_break: "bg-blue-500 hover:bg-blue-400 active:bg-blue-600",
  }[phase];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {/* Reset button */}
      <button
        disabled={disabled}
        onClick={onReset}
        className={`
          p-2.5 sm:p-4 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm transition-all duration-200 shadow-lg disabled:opacity-40 disabled:pointer-events-none
          ${accentColor}
        `}
        title="Reset (R)"
        aria-label="Reset timer"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </button>

      {/* Play/Pause button */}
      <button
        disabled={disabled}
        onClick={running ? onPause : onStart}
        className={`
          p-4 sm:p-6 rounded-full transition-all duration-200 shadow-2xl disabled:opacity-40 disabled:pointer-events-none
          ${primaryColor}
        `}
        title={running ? "Pause (Space)" : "Start (Space)"}
        aria-label={running ? "Pause timer" : "Start timer"}
      >
        {running ? (
          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Skip button */}
      <button
        disabled={disabled}
        onClick={onSkip}
        className={`
          p-2.5 sm:p-4 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm transition-all duration-200 shadow-lg disabled:opacity-40 disabled:pointer-events-none
          ${accentColor}
        `}
        title="Skip to next phase (S)"
        aria-label="Skip to next phase"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" />
        </svg>
      </button>
    </div>
  );
}

