"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExamInfo, LibraryRoom, STUDY_ROOMS, examRooms, librarySchedule, displayedLibraryCount, examCountdownText, examDateLabel, nextFocusStart, minutesUntil } from "@/lib/library";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const localClock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function peopleLabel(n: number | undefined, short = false): string {
  if (n === undefined) return "";
  if (n === 0) return "Empty";
  return short ? `${n} in` : `${n} ${n === 1 ? "person" : "people"} here`;
}

/** Live clock + real headcounts. Starts from values rendered on the server so nothing is blank before JS loads. */
function useLiveRooms(initialNow?: number, initialCounts?: Record<string, number>) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts ?? {});
  const [now, setNow] = useState<number | null>(initialNow ?? null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch(`${BACKEND_URL}/library`)
        .then((r) => r.json())
        .then((d: { rooms: { id: string; count: number }[] }) => setCounts(Object.fromEntries(d.rooms.map((r) => [r.id, r.count]))))
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const first = setTimeout(() => { setNow(Date.now()); setMounted(true); }, 0);
    return () => { clearInterval(poll); clearInterval(tick); clearTimeout(first); };
  }, []);

  const countFor = (id: string) => {
    const real = counts[id];
    return real === undefined || !now ? undefined : displayedLibraryCount(id, real, now);
  };
  return { now, mounted, countFor };
}

interface Props {
  rows?: boolean;
  exams?: ExamInfo["region"];
  initialNow?: number;
  initialCounts?: Record<string, number>;
}

// The public silent rooms as a timetable: what's on now, when the next block starts, and who's there
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
                  {count !== undefined && <span className="text-xs text-white/50 whitespace-nowrap">{peopleLabel(count, true)}</span>}
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
        const s = now ? librarySchedule(room, now) : null;
        const next = now ? nextFocusStart(room, now) : null;
        const count = countFor(room.id);
        return (
          <li key={room.id}>
            <Link
              href={`/library/${room.id}`}
              className="group grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 py-4 sm:py-5 px-1 hover:bg-stone-800/30 transition-colors"
            >
              <div className="min-w-0">
                <h3 className="font-serif text-xl text-stone-100 group-hover:text-white leading-snug">
                  {room.name} <span className="ml-1 font-mono text-xs text-stone-500 align-middle">{room.focusMin}/{room.breakMin}</span>
                </h3>
                {room.exam && now ? (
                  <p className="mt-1 text-sm text-amber-200/90">
                    {examCountdownText(room.exam, now)} <span className="text-stone-500">· {examDateLabel(room.exam, now)}</span>
                  </p>
                ) : room.blurb ? (
                  <p className="mt-1 text-sm text-stone-400">{room.blurb}</p>
                ) : null}
              </div>
              <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto flex flex-wrap gap-x-4 gap-y-1 text-sm sm:contents">
                <p className="tabular-nums">
                  {s && (
                    <>
                      <span className={s.phase === "focus" ? "text-rose-300" : "text-emerald-300"}>{s.phase === "focus" ? "Focus" : "Break"}</span>
                      <span className="text-stone-400"> · {Math.ceil(s.remainingSec / 60)} min left</span>
                    </>
                  )}
                </p>
                <p className="tabular-nums text-stone-400 whitespace-nowrap">
                  {next && now && (
                    <>Next block {mounted ? <><span className="text-stone-200">{localClock(next)}</span> · {minutesUntil(next, now)}</> : <>in {minutesUntil(next, now)}</>}</>
                  )}
                </p>
              </div>
              <p className={`col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto text-right text-sm whitespace-nowrap ${count ? "text-emerald-300" : "text-stone-500"}`}>
                {count ? <span className="inline-block w-1.5 h-1.5 mr-1.5 align-middle rounded-full bg-emerald-400" /> : null}
                {peopleLabel(count)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
