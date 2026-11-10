"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { asSchedule, formatCountdown, upcomingSessions } from "@/lib/dailySessions";
import { googleCalendarUrl, icsContent } from "@/lib/schedule";
import { absoluteUrl } from "@/lib/site";

function useNow(ms = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [ms]);
  return now;
}

const localTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
// True when the viewer's clock shows the same time as the session's zone
const sameZone = (t: number, tz: string) => {
  const o = { hour: "numeric", minute: "2-digit" } as const;
  try { return new Date(t).toLocaleTimeString("en-US", o) === new Date(t).toLocaleTimeString("en-US", { ...o, timeZone: tz }); } catch { return false; }
};
const zoneTime = (h: number, m: number) => new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function downloadIcs(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "pikoo-daily-session.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Full list for /library: every daily session with status, join and calendar links */
export function DailySessions() {
  const now = useNow();
  const rows = now ? upcomingSessions(now) : [];
  return (
    <section aria-labelledby="daily-sessions" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 id="daily-sessions" className="font-semibold">Daily group sessions</h2>
      <p className="mt-1 text-sm text-white/55">Two hours of Pomodoros at the same time every day, so there&apos;s always someone focusing with you. Add one to your calendar and just show up.</p>
      <ul className="mt-4 divide-y divide-white/5">
        {rows.map(({ session: s, start, end, live }) => {
          const title = `${s.label} · Pikoo`;
          const url = absoluteUrl(`/library/${s.roomId}`);
          const sched = asSchedule(s, start);
          return (
            <li key={s.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">
                  {s.label} <span className="text-white/45 font-normal">· {zoneTime(s.hour, s.minute)} {s.tzLabel}</span>
                </p>
                <p className={`text-xs mt-0.5 ${live ? "text-green-300" : "text-white/45"}`}>
                  {live ? `Live now · ${formatCountdown(end - now!)} left` : `Starts in ${formatCountdown(start - now!)}${sameZone(start, s.tz) ? "" : ` · ${localTime(start)} your time`}`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <a href={googleCalendarUrl(sched, start, title, url)} target="_blank" rel="noopener" className="h-8 px-3 inline-flex items-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70">Add to calendar</a>
                <button onClick={() => downloadIcs(icsContent(sched, start, title, url))} className="h-8 px-2 text-white/45 hover:text-white/80">.ics</button>
                <Link href={`/library/${s.roomId}`} className={`h-8 px-3 inline-flex items-center rounded-full font-medium ${live ? "bg-green-500/20 text-green-200 hover:bg-green-500/30" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                  {live ? "Join now" : "Open room"}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One line: the live or next session (homepage, library rooms) */
export function NextSessionLine({ roomId, className = "" }: { roomId?: string; className?: string }) {
  const now = useNow();
  if (!now) return null;
  const next = upcomingSessions(now).find((r) => !roomId || r.session.roomId === roomId);
  if (!next) return null;
  const { session: s, start, end, live } = next;
  const text = live
    ? `${s.label} is live now · ${formatCountdown(end - now)} left`
    : `Next group session: ${sameZone(start, s.tz) ? `${zoneTime(s.hour, s.minute)} ${s.tzLabel}` : `${localTime(start)} your time (${zoneTime(s.hour, s.minute)} ${s.tzLabel})`}, in ${formatCountdown(start - now)}`;
  return roomId ? (
    <p className={`text-xs ${live ? "text-green-300" : "text-white/40"} ${className}`}>{live && <span className="inline-block w-1.5 h-1.5 mr-1.5 align-middle rounded-full bg-green-400 animate-pulse" />}{text}</p>
  ) : (
    <Link href={live ? `/library/${s.roomId}` : "/library#daily-sessions"} className={`text-xs ${live ? "text-green-300 hover:text-green-200" : "text-white/45 hover:text-white/75"} ${className}`}>
      {live && <span className="inline-block w-1.5 h-1.5 mr-1.5 align-middle rounded-full bg-green-400 animate-pulse" />}{text} →
    </Link>
  );
}
