"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LIBRARY_ROOMS, librarySchedule, displayedLibraryCount } from "@/lib/library";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// Cards for the public silent rooms, with live phase and headcount
export function LibraryList({ compact = false, strip = false }: { compact?: boolean; strip?: boolean }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`${BACKEND_URL}/library`)
        .then((r) => r.json())
        .then((d: { rooms: { id: string; count: number }[] }) => setCounts(Object.fromEntries(d.rooms.map((r) => [r.id, r.count]))))
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const first = setTimeout(() => setNow(Date.now()), 0);
    return () => { clearInterval(poll); clearInterval(tick); clearTimeout(first); };
  }, []);

  if (strip) {
    // One-line cards for the homepage hero
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {LIBRARY_ROOMS.map((room) => {
          const s = now ? librarySchedule(room, now) : null;
          const real = counts[room.id];
          const count = real === undefined || !now ? undefined : displayedLibraryCount(room.id, real, now);
          return (
            <Link
              key={room.id}
              href={`/library/${room.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-white/30 hover:bg-white/[0.06] transition-colors text-left"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white truncate">{room.name}</span>
                <span className={`block text-xs mt-0.5 ${s?.phase === "break" ? "text-emerald-300" : "text-rose-300"}`}>
                  {s ? `${room.focusMin}/${room.breakMin} · ${s.phase === "focus" ? "Focus" : "Break"} ${Math.ceil(s.remainingSec / 60)}m left` : " "}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/50 whitespace-nowrap">
                {count !== undefined && count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                {count === undefined ? "" : count === 0 ? "Join →" : `${count} in`}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : ""}`}>
      {LIBRARY_ROOMS.map((room) => {
        const s = now ? librarySchedule(room, now) : null;
        const mins = s ? Math.ceil(s.remainingSec / 60) : null;
        const real = counts[room.id];
        const count = real === undefined || !now ? undefined : displayedLibraryCount(room.id, real, now);
        return (
          <Link
            key={room.id}
            href={`/library/${room.id}`}
            className="group block p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/25 transition-colors text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">{room.name}</h3>
              <span className="text-xs font-mono text-white/40">{room.focusMin}/{room.breakMin}</span>
            </div>
            {!compact && <p className="mt-1.5 text-sm text-white/55">{room.blurb}</p>}
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className={s?.phase === "focus" ? "text-rose-300" : "text-emerald-300"}>
                {s ? `${s.phase === "focus" ? "Focus" : "Break"} · ${mins} min left` : " "}
              </span>
              <span className="flex items-center gap-1.5 text-white/50">
                {count !== undefined && count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                {count === undefined ? "" : count === 0 ? "Be the first" : `${count} focusing`}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
