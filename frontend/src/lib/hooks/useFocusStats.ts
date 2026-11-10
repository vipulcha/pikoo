"use client";

import { useEffect, useRef, useState } from "react";
import { ActivityLog, TimerState } from "../types";

// Per-device focus stats for today, kept in localStorage (never sent anywhere).
// Seconds count while this tab is open and the room is in a running focus phase.

export interface FocusStats {
  seconds: number;
  sessions: number;
}

const todayKey = () => {
  const d = new Date();
  return `pikoo:focus:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function read(): FocusStats {
  try {
    const raw = localStorage.getItem(todayKey());
    if (raw) {
      const v = JSON.parse(raw);
      return { seconds: Number(v.seconds) || 0, sessions: Number(v.sessions) || 0 };
    }
  } catch {
    // Storage unavailable (private mode etc.): stats just start at zero
  }
  return { seconds: 0, sessions: 0 };
}

function write(s: FocusStats) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(s));
  } catch {
    // Ignore: stats are a nice-to-have
  }
}

// The server logs "Focus finished" when a focus phase runs out on its own (not skipped)
const isFocusFinished = (log?: ActivityLog) =>
  !!log && log.type === "timer_skip" && log.userId === "system" && log.details === "Focus finished";

// Counts focus seconds while `focusing` is true, and one session each time
// `finishedKey` changes to a new non-null value (a focus phase that ran out).
export function useFocusCounter(focusing: boolean, finishedKey: string | null): FocusStats {
  const [stats, setStats] = useState<FocusStats>({ seconds: 0, sessions: 0 });
  const countedRef = useRef<string | null>(null);

  // Tick while focusing (setState only from timer callbacks)
  useEffect(() => {
    const load = setTimeout(() => setStats(read()), 0);
    if (!focusing) return () => clearTimeout(load);
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(5, Math.round((now - last) / 1000)); // cap gaps from sleeping laptops
      last = now;
      const next = read();
      next.seconds += delta;
      write(next);
      setStats(next);
    }, 1000);
    return () => { clearTimeout(load); clearInterval(id); };
  }, [focusing]);

  useEffect(() => {
    if (!finishedKey || countedRef.current === finishedKey) return;
    countedRef.current = finishedKey;
    const next = read();
    next.sessions += 1;
    write(next);
    const t = setTimeout(() => setStats(next), 0);
    return () => clearTimeout(t);
  }, [finishedKey]);

  return stats;
}

export function useFocusStats(timer: TimerState | undefined, history: ActivityLog[] | undefined) {
  const [mountedAt] = useState(() => Date.now());
  const latest = history?.[0];
  const finishedId = isFocusFinished(latest) && latest!.timestamp >= mountedAt ? latest!.id : null;
  const stats = useFocusCounter(!!timer?.running && timer.phase === "focus", finishedId);
  return { stats, finishedId };
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
