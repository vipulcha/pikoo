"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { getUserId } from "@/components/NamePrompt";
import { notifyFocusEnd, notifyBreakEnd } from "@/lib/audio";

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

type Phase = "focus" | "break";

// A timer that runs entirely in the browser (no room, no account). Pomodoro
// presets alternate focus and break automatically. "Make it shared" turns it
// into a room with the same lengths.
export function SoloTimer({ focusMin, breakMin }: { focusMin: number; breakMin: number | null }) {
  const router = useRouter();
  const lengthOf = useCallback((p: Phase) => (p === "focus" ? focusMin : breakMin ?? 0) * 60, [focusMin, breakMin]);

  const [phase, setPhase] = useState<Phase>("focus");
  const [endsAt, setEndsAt] = useState<number | null>(null);           // set while running
  const [remaining, setRemaining] = useState(focusMin * 60);           // shown while paused
  const [cycles, setCycles] = useState(0);
  const [done, setDone] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0); // updated by the interval while running

  const running = endsAt !== null;
  const left = running ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : remaining;

  const start = () => { const t = Date.now(); setDone(false); setNow(t); setEndsAt(t + remaining * 1000); };
  const pause = () => { if (endsAt) { setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))); setEndsAt(null); } };
  const reset = () => { setEndsAt(null); setPhase("focus"); setRemaining(lengthOf("focus")); setDone(false); };

  // Countdown + phase changes happen in the interval callback
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t < endsAt) return;
      if (breakMin === null) {
        notifyFocusEnd();
        setEndsAt(null);
        setRemaining(lengthOf("focus"));
        setDone(true);
        return;
      }
      const next: Phase = phase === "focus" ? "break" : "focus";
      if (next === "break") { notifyFocusEnd(); setCycles((c) => c + 1); } else notifyBreakEnd();
      setPhase(next);
      setEndsAt(t + lengthOf(next) * 1000);
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, phase, breakMin, lengthOf]);

  useEffect(() => {
    document.title = running || left !== focusMin * 60 ? `${fmt(left)} ${phase === "break" ? "Break" : "Focus"} · Pikoo` : document.title;
  }, [left, running, phase, focusMin]);

  // Space starts/pauses, like in rooms
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, button, a, [contenteditable='true']")) return;
      e.preventDefault();
      if (endsAt !== null) pause(); else start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const makeShared = async () => {
    setSharing(true);
    setError(null);
    try {
      const { roomId } = await createRoom({ focusSec: focusMin * 60, breakSec: (breakMin ?? 5) * 60 }, getUserId());
      router.push(`/r/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create a room");
      setSharing(false);
    }
  };

  const accent = phase === "break" ? "text-emerald-300" : "text-rose-300";
  const total = lengthOf(phase);
  const progress = total > 0 ? 1 - left / total : 0;

  return (
    <div className="flex flex-col items-center text-center">
      <p className={`text-sm font-semibold uppercase tracking-[0.25em] ${accent}`}>
        {done ? "Time's up" : breakMin === null ? "Timer" : phase === "focus" ? "Focus" : "Break"}
        {cycles > 0 && <span className="text-white/35"> · #{cycles}</span>}
      </p>
      <div className="font-mono font-light leading-none tracking-tighter text-[clamp(4.5rem,20vw,11rem)]" style={{ fontFeatureSettings: '"tnum"' }} aria-live="off">
        {fmt(left)}
      </div>
      <div className="mt-4 w-56 sm:w-80 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full ${phase === "break" ? "bg-emerald-400" : "bg-rose-400"} transition-[width] duration-300`} style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button onClick={reset} className="h-12 px-5 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-sm">Reset</button>
        <button
          onClick={running ? pause : start}
          className={`h-14 px-10 rounded-full text-base font-semibold ${phase === "break" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"}`}
        >
          {running ? "Pause" : left === lengthOf(phase) ? "Start" : "Resume"}
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <button onClick={makeShared} disabled={sharing} className="text-sm text-white/70 hover:text-white underline underline-offset-4 decoration-white/30 disabled:opacity-50">
          {sharing ? "Creating room…" : "Make it shared: focus on this timer with friends →"}
        </button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
