"use client";

import { useEffect, useRef, useState } from "react";
import { ActivityLog, TimerState } from "../types";

// Per-device focus stats for today, kept in localStorage (never sent anywhere).
// Seconds count while this tab is open and the room is in a running focus phase.

export interface FocusStats {
  seconds: number;         // today, all rooms, this device
  sessions: number;        // focus blocks finished today (only ones you were actually in)
  lastSessionSec?: number; // how long you were present for the block that just finished
}

interface Stored { seconds: number; sessions: number; tickAt: number; lastKey: string | null }

// A focus block only counts as "your" session if you were there for at least this long
const MIN_SESSION_SEC = 60;

const todayKey = () => {
  const d = new Date();
  return `pikoo:focus:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function read(): Stored {
  try {
    const raw = localStorage.getItem(todayKey());
    if (raw) {
      const v = JSON.parse(raw);
      return { seconds: Number(v.seconds) || 0, sessions: Number(v.sessions) || 0, tickAt: Number(v.tickAt) || 0, lastKey: typeof v.lastKey === "string" ? v.lastKey : null };
    }
  } catch {
    // Storage unavailable (private mode etc.): stats just start at zero
  }
  return { seconds: 0, sessions: 0, tickAt: 0, lastKey: null };
}

function write(s: Stored) {
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
  const sessionSecRef = useRef(0); // seconds present in the current focus block

  // Tick while focusing (setState only from timer callbacks). The last tick time is
  // shared through storage, so two open tabs don't count the same second twice.
  useEffect(() => {
    const load = setTimeout(() => setStats((cur) => ({ ...cur, ...pick(read()) })), 0);
    if (!focusing) return () => clearTimeout(load);
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const next = read();
      const delta = Math.max(0, Math.min(5, (now - Math.max(last, next.tickAt)) / 1000)); // cap gaps from sleeping laptops
      sessionSecRef.current += Math.min(5, (now - last) / 1000); // this tab's own clock
      last = now;
      next.seconds += delta;
      next.tickAt = now;
      write(next);
      setStats((cur) => ({ ...cur, ...pick(next) }));
    }, 1000);
    return () => { clearTimeout(load); clearInterval(id); };
  }, [focusing]);

  useEffect(() => {
    if (!finishedKey || countedRef.current === finishedKey) return;
    countedRef.current = finishedKey;
    const present = Math.round(sessionSecRef.current);
    sessionSecRef.current = 0;
    const next = read();
    if (present >= MIN_SESSION_SEC && next.lastKey !== finishedKey) {
      next.sessions += 1;
      next.lastKey = finishedKey;
      write(next);
    }
    const t = setTimeout(() => setStats({ ...pick(next), lastSessionSec: present }), 0);
    return () => clearTimeout(t);
  }, [finishedKey]);

  return stats;
}

const pick = (s: Stored) => ({ seconds: Math.floor(s.seconds), sessions: s.sessions });

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
