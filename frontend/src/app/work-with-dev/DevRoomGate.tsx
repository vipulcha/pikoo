"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RoomScreen } from "@/components/RoomScreen";
import { SiteFooter } from "@/components/SiteFooter";
import { isDevBrowser, useDevStatus } from "@/components/DevRoomBits";
import { DEV_PATH, DEV_ROOM_ID, DevRoomStatus, sinceLabel } from "@/lib/devRoom";
import { nextOccurrence, formatWhen, googleCalendarUrl } from "@/lib/schedule";
import { trace } from "@/lib/trace";

/** Why the visitor is back on the landing page: "ended", or the server's code ("REMOVED", "DEV_OFFLINE") */
const PAGE_TITLE = "Work With the Developer of Pikoo – Live Focus Room | Pikoo";

type Closed = { reason: string; at: number } | null;

// Landing page while the developer is offline; the shared room while they're live.
// The developer's own browser always gets the room (with the Go live button).
export function DevRoomGate({ initialStatus }: { initialStatus?: DevRoomStatus }) {
  const [isHost, setIsHost] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [closed, setClosed] = useState<Closed>(null);
  const decided = useRef(false);

  // While on the landing page, check every 20s so it notices when a session starts
  const polled = useDevStatus(20_000, !inRoom);
  const status = polled ?? initialStatus;

  useEffect(() => {
    let cancelled = false;
    void isDevBrowser().then((host) => {
      if (cancelled || decided.current) return;
      decided.current = true;
      if (host) {
        setIsHost(true);
        setInRoom(true);
      } else if (initialStatus?.live) {
        // Arrived while live (from the homepage badge, a shared link): straight in
        trace("dev_room", { action: "auto_join" });
        setInRoom(true);
      }
    });
    return () => { cancelled = true; };
  }, [initialStatus?.live]);

  const onClosed = useCallback((reason: string) => {
    trace("dev_room", { action: "closed", reason });
    setInRoom(false);
    setClosed({ reason, at: Date.now() });
  }, []);

  if (inRoom) {
    return <RoomScreen roomId={DEV_ROOM_ID} dev={{ isHost, path: DEV_PATH, onClosed }} />;
  }

  return (
    <Landing
      status={status}
      closed={closed}
      onJoin={() => { trace("dev_room", { action: "join_click" }); setClosed(null); setInRoom(true); }}
    />
  );
}

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Landing({ status, closed, onJoin }: { status?: DevRoomStatus; closed: Closed; onJoin: () => void }) {
  const now = useNow();
  // Coming back from the room, whose timer took over the tab title
  useEffect(() => { document.title = PAGE_TITLE; }, []);
  // A status fetched before the session closed still says "live"
  const stale = !!closed && (status?.since ?? 0) <= closed.at;
  const live = !!status?.live && closed?.reason !== "REMOVED" && !stale;
  const others = Math.max(0, (status?.people ?? 0) - 1);
  const minutesLeft = status?.running && status.phaseEndsAt && now ? Math.max(0, Math.ceil((status.phaseEndsAt - now) / 60_000)) : null;
  const next = status?.schedule && now ? nextOccurrence(status.schedule, now) : null;
  const focusMin = status?.focusMin ?? 50;
  const breakMin = status?.breakMin ?? 10;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.12),transparent_60%)]" />
      <header className="relative border-b border-white/10">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-white/90 hover:text-white">Pikoo</Link>
          <Link href="/" className="text-sm text-white/50 hover:text-white">Make your own room →</Link>
        </div>
      </header>

      <main className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-14 sm:pt-20 pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/90">Work with the developer</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight leading-tight">Focus alongside the developer of Pikoo</h1>
        <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-2xl">
          Pikoo is a free shared Pomodoro timer, built by one developer. When I sit down to work on it, this room goes
          live: anyone can join, work on their own thing on the same timer, and chat in the breaks.
        </p>

        <section aria-live="polite" className={`mt-10 rounded-3xl border p-6 sm:p-8 ${live ? "border-rose-400/40 bg-rose-500/10" : "border-white/10 bg-white/[0.03]"}`}>
          {closed?.reason === "REMOVED" ? (
            <>
              <p className="text-lg font-medium">You were removed from this session.</p>
              <p className="mt-2 text-sm text-white/55">The silent library is open any time.</p>
            </>
          ) : live ? (
            <>
              <p className="flex items-center gap-2 text-rose-100 font-medium">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-rose-400" />
                </span>
                Live now{status?.since && now ? ` for ${sinceLabel(status.since, now)}` : ""}
              </p>
              <p className="mt-2 text-sm text-white/60">
                {others === 0 ? "Just the developer so far. Be the first to join." : `The developer and ${others} ${others === 1 ? "other person" : "others"} are focusing.`}
                {minutesLeft !== null && ` ${status?.phase === "focus" ? "Focus" : "Break"}: ${minutesLeft} min left.`}
              </p>
              <button onClick={onJoin} className="mt-6 h-12 px-6 rounded-full bg-rose-500 hover:bg-rose-400 font-semibold">
                Join the session
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">{closed?.reason === "ended" ? "The session just ended. Thanks for focusing!" : "Not live right now"}</p>
              {next && now && status?.schedule ? (
                <p className="mt-2 text-sm text-white/60">
                  Next session: <span className="text-white/85">{formatWhen(next, now)}</span> (your time).{" "}
                  <a
                    href={googleCalendarUrl(status.schedule, next, "Work with the developer of Pikoo", typeof window !== "undefined" ? `${window.location.origin}${DEV_PATH}` : DEV_PATH)}
                    target="_blank"
                    rel="noopener"
                    className="underline underline-offset-4 decoration-white/30 hover:text-white"
                  >
                    Add to Google Calendar
                  </a>
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/60">This page switches on by itself when a session starts, so you can leave it open. The homepage shows it too.</p>
              )}
              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <Link href="/library" className="h-11 px-5 rounded-full bg-white/10 hover:bg-white/15 text-sm flex items-center justify-center">Focus in a silent room meanwhile</Link>
                <Link href="/" className="h-11 px-5 rounded-full border border-white/15 hover:bg-white/5 text-sm flex items-center justify-center">Make a room for you and friends</Link>
              </div>
            </>
          )}
        </section>

        <section className="mt-14 grid gap-8 sm:grid-cols-3 text-sm text-white/60 leading-relaxed">
          <div>
            <h2 className="text-white font-medium">One timer for everyone</h2>
            <p className="mt-2">The developer runs it: {focusMin} minutes of focus, {breakMin} minutes of break. Work on whatever you like.</p>
          </div>
          <div>
            <h2 className="text-white font-medium">Chat in the breaks</h2>
            <p className="mt-2">Say hi, ask about Pikoo, suggest a feature, or just work quietly. Your task list can stay private.</p>
          </div>
          <div>
            <h2 className="text-white font-medium">No sign-up</h2>
            <p className="mt-2">Pick any name and join. Be kind: the developer can remove people from the session.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
