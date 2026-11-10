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

export function useFocusStats(timer: TimerState | undefined, history: ActivityLog[] | undefined) {
  const [stats, setStats] = useState<FocusStats>({ seconds: 0, sessions: 0 });
  const [mountedAt] = useState(() => Date.now());
  const countedRef = useRef<string | null>(null);

  const focusing = !!timer?.running && timer.phase === "focus";

  // Tick while focusing (setState only from the interval callback)
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

  // A focus session that finished while this tab was open: count it once
  const latest = history?.[0];
  const justFinished = isFocusFinished(latest) && latest!.timestamp >= mountedAt;
  useEffect(() => {
    if (!justFinished || countedRef.current === latest!.id) return;
    countedRef.current = latest!.id;
    const next = read();
    next.sessions += 1;
    write(next);
    const t = setTimeout(() => setStats(next), 0);
    return () => clearTimeout(t);
  }, [justFinished, latest]);

  return { stats, finishedId: justFinished ? latest!.id : null };
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
