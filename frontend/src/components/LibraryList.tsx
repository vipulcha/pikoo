"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExamInfo, LibraryRoom, STUDY_ROOMS, MAIN_CLOCK, examRooms, librarySchedule, displayedLibraryCount, examDateLabel, examDaysLabel, nextFocusStart, minutesUntil, onMainClock } from "@/lib/library";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const localClock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/**
 * A clock that ticks every second. Starts from the server's time so the first
 * client render matches the HTML; local-timezone strings wait for `mounted`.
 */
function useTick(initialNow?: number) {
  const [now, setNow] = useState<number | null>(initialNow ?? null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const first = setTimeout(() => { setNow(Date.now()); setMounted(true); }, 0);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(tick); };
  }, []);
  return { now, mounted };
}

/** Live clock + real headcounts. Starts from values rendered on the server so nothing is blank before JS loads. */
function useLiveRooms(initialNow?: number, initialCounts?: Record<string, number>) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts ?? {});
  const { now, mounted } = useTick(initialNow);

  useEffect(() => {
    const load = () =>
      fetch(`${BACKEND_URL}/library`)
        .then((r) => r.json())
        .then((d: { rooms: { id: string; count: number }[] }) => setCounts(Object.fromEntries(d.rooms.map((r) => [r.id, r.count]))))
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, []);

  const countFor = (id: string) => {
    const real = counts[id];
    return real === undefined || !now ? undefined : displayedLibraryCount(id, real, now);
  };
  return { now, mounted, countFor };
}

/** The 50/10 clock that Deep Work and every exam room share, shown once at the top of /library */
export function SharedClock({ initialNow }: { initialNow?: number }) {
  const { now, mounted } = useTick(initialNow);
  const s = now ? librarySchedule(MAIN_CLOCK, now) : null;
  const next = now ? nextFocusStart(MAIN_CLOCK, now) : null;
  return (
    <div className="rounded-2xl border border-stone-700/60 bg-stone-900/70 px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`text-sm font-semibold uppercase tracking-[0.2em] ${s?.phase === "break" ? "text-emerald-300" : "text-rose-300"}`}>
          {s ? (s.phase === "focus" ? "Focus" : "Break") : " "}
        </span>
        <span className="font-mono text-5xl sm:text-6xl leading-none tracking-tight text-stone-50 tabular-nums">{s ? mmss(s.remainingSec) : "--:--"}</span>
        <span className="text-stone-400">left</span>
      </div>
      <p className="mt-3 text-stone-200 tabular-nums">
        {next && now && (
          <>Next block starts {mounted ? <>{localClock(next)} · </> : null}<span className="whitespace-nowrap">in {minutesUntil(next, now)}</span></>
        )}
      </p>
      <p className="mt-1 text-sm text-stone-500">Deep Work and all exam rooms run on this 50/10 clock.</p>
    </div>
  );
}

interface Props {
  rows?: boolean;
  exams?: ExamInfo["region"];
  initialNow?: number;
  initialCounts?: Record<string, number>;
}

// The public silent rooms: name, who's there, and a way in
export function LibraryList({ rows = false, exams, initialNow, initialCounts }: Props) {
  const rooms: LibraryRoom[] = exams ? examRooms(exams) : STUDY_ROOMS;
  const { now, mounted, countFor } = useLiveRooms(initialNow, initialCounts);

  if (rows) {
    // Homepage card: total headcount plus one tappable row per room
    const shown = rooms.map((room) => countFor(room.id));
    const total = shown.every((c) => c !== undefined) ? shown.reduce<number>((a, c) => a + (c ?? 0), 0) : null;
    const soonest = now ? Math.min(...rooms.map((r) => nextFocusStart(r, now))) : null;
    return (
      <div>
        <p className="flex items-center gap-2 text-sm text-white/70 h-5">
          <span className={`w-2 h-2 rounded-full ${total ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
          {total === null ? "Rooms are open" : total > 0 ? `${total} ${total === 1 ? "person" : "people"} focusing right now` : `Quiet right now · next block starts in ${minutesUntil(soonest!, now!)}`}
        </p>
        <ul className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          {rooms.map((room, i) => {
            const s = now ? librarySchedule(room, now) : null;
            const count = shown[i];
            return (
              <li key={room.id}>
                <Link href={`/library/${room.id}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white truncate">{room.name}</span>
                    <span className="block text-xs mt-0.5 text-white/50">
                      <span className="font-mono">{room.focusMin}/{room.breakMin}</span>
                      {s && (
                        <span className={s.phase === "break" ? "text-emerald-300" : "text-rose-300"}>
                          {" "}· {s.phase === "focus" ? "Focus" : "Break"}, {Math.ceil(s.remainingSec / 60)}m left
                        </span>
                      )}
                    </span>
                  </span>
                  {count ? <span className="text-xs text-white/50 whitespace-nowrap">{count} in</span> : null}
                  <span className="shrink-0 h-8 px-3.5 inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    Join
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-stone-700/50 border-y border-stone-700/50">
      {rooms.map((room) => {
        const count = countFor(room.id);
        // Rooms on their own rhythm say when their next block starts; the rest follow the clock at the top
        const next = !onMainClock(room) && now ? nextFocusStart(room, now) : null;
        return (
          <li key={room.id}>
            <Link href={`/library/${room.id}`} className="group flex items-center gap-4 py-4 px-1 hover:bg-stone-800/30 transition-colors">
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl text-stone-100 group-hover:text-white leading-snug">{room.name}</h3>
                {room.exam && now ? (
                  <p className="mt-0.5 text-sm">
                    <span className="text-amber-200/90">{examDaysLabel(room.exam, now)}</span>
                    <span className="text-stone-500"> · {examDateLabel(room.exam, now)}</span>
                  </p>
                ) : next && now ? (
                  <p className="mt-0.5 text-sm text-stone-400 tabular-nums">
                    <span className="font-mono text-xs text-stone-500">{room.focusMin}/{room.breakMin}</span> · next block{" "}
                    {mounted ? <span className="text-stone-200">{localClock(next)}</span> : <>in {minutesUntil(next, now)}</>}
                  </p>
                ) : null}
              </div>
              {count ? (
                <span className="shrink-0 text-sm text-emerald-300 whitespace-nowrap">
                  <span className="inline-block w-1.5 h-1.5 mr-1.5 align-middle rounded-full bg-emerald-400" />
                  {count} here
                </span>
              ) : null}
              <span className="shrink-0 h-9 px-4 inline-flex items-center rounded-full bg-stone-800 text-stone-200 text-sm font-medium group-hover:bg-stone-100 group-hover:text-stone-900 transition-colors">
                Join
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
