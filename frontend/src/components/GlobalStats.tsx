"use client";

import { useEffect, useState } from "react";
import { getStats, SiteTotals } from "@/lib/api";

const COLS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };
const fmt = (n: number) => n.toLocaleString("en-US");

// All-time numbers from the backend counters (sessions include the pre-counter baseline)
export function GlobalStats() {
  const [totals, setTotals] = useState<SiteTotals | null>(null);

  useEffect(() => {
    getStats().then((s) => setTotals(s.totals ?? null)).catch(() => setTotals(null));
  }, []);

  const items = totals
    ? [
        { value: `${fmt(totals.focusSessions)}${totals.focusSessions >= 300 ? "+" : ""}`, label: "focus sessions completed" },
        // Hours and rooms only show once they're big enough to mean something
        ...(totals.focusHours >= 50 ? [{ value: fmt(totals.focusHours), label: "hours focused together" }] : []),
        ...(totals.roomsCreated >= 50 ? [{ value: fmt(totals.roomsCreated), label: "rooms created" }] : []),
      ]
    : [{ value: "300+", label: "focus sessions completed" }];

  return (
    <div className={`grid gap-8 ${COLS[items.length] ?? ""}`}>
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums">{it.value}</p>
          <p className="mt-2 text-white/60">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
