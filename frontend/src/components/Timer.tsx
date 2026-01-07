"use client";

import { Phase, PHASE_LABELS } from "@/lib/types";

interface TimerProps {
  remaining: number;
  phase: Phase;
  running: boolean;
  cycleCount: number;
}

function formatTime(seconds: number): { minutes: string; secs: string } {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return {
    minutes: String(mins).padStart(2, "0"),
    secs: String(secs).padStart(2, "0"),
  };
}

export function Timer({ remaining, phase, running, cycleCount }: TimerProps) {
  const { minutes, secs } = formatTime(remaining);

  return (
    <div className="flex flex-col items-center">
      {/* Phase indicator */}
      <div className="mb-6 flex items-center gap-3">
        <span 
          className={`
            px-4 py-1.5 rounded-full text-sm font-medium tracking-wide uppercase
            ${phase === "focus" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : ""}
            ${phase === "break" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : ""}
            ${phase === "long_break" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : ""}
          `}
        >
          {PHASE_LABELS[phase]}
        </span>
        {cycleCount > 0 && (
          <span className="text-white/40 text-sm">
            #{cycleCount}
          </span>
        )}
      </div>

      {/* Main timer display */}
      <div className="relative">
        {/* Timer digits */}
        <div className="relative flex items-baseline font-mono drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <span 
            className={`
              text-[12rem] sm:text-[16rem] font-extralight tracking-tighter leading-none
              ${running ? "animate-pulse" : ""}
            `}
            style={{ fontFeatureSettings: '"tnum"', textShadow: '0 0 60px rgba(0,0,0,0.5)' }}
          >
            {minutes}
          </span>
          <span 
            className={`
              text-[8rem] sm:text-[10rem] font-extralight mx-2 sm:mx-4
              ${running ? "animate-blink" : "opacity-60"}
            `}
          >
            :
          </span>
          <span 
            className="text-[12rem] sm:text-[16rem] font-extralight tracking-tighter leading-none"
            style={{ fontFeatureSettings: '"tnum"', textShadow: '0 0 60px rgba(0,0,0,0.5)' }}
          >
            {secs}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-8 flex items-center gap-2">
        <span 
          className={`
            w-2 h-2 rounded-full
            ${running ? "bg-green-400 animate-pulse" : "bg-white/30"}
          `}
        />
        <span className="text-white/50 text-sm uppercase tracking-widest">
          {running ? "Running" : "Paused"}
        </span>
      </div>
    </div>
  );
}

