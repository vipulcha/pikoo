"use client";

import { trace } from "@/lib/trace";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { AudioPlayer } from "@/components/AudioPlayer";
import { NextSessionLine } from "@/components/DailySessions";
import { SessionSummary } from "@/components/GrowthCards";
import { getUserId } from "@/components/NamePrompt";
import { LibraryRoom, LIBRARY_REACTIONS, librarySchedule, displayedLibraryCount, ambientReaction, examCountdownText, examDateLabel } from "@/lib/library";
import { serverNow, syncClock } from "@/lib/clock";
import { useFocusCounter } from "@/lib/hooks/useFocusStats";
import { notifyFocusEnd, notifyBreakEnd, getNotificationPermission, requestNotificationPermission } from "@/lib/audio";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const INTRO_KEY = "pikoo:library-intro-seen";

interface Floating { id: number; emoji: string; left: number }

export function LibraryRoomView({ room }: { room: LibraryRoom }) {
  const socketRef = useRef<Socket | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [floating, setFloating] = useState<Floating[]>([]);
  const [finishedKey, setFinishedKey] = useState<string | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const prevPhase = useRef<"focus" | "break" | null>(null);
  const lastAmbientSec = useRef<number | null>(null);

  const float = (emoji: string, left = 10 + Math.random() * 80) => {
    const f = { id: Math.random(), emoji, left };
    setFloating((list) => [...list.slice(-20), f]);
    setTimeout(() => setFloating((list) => list.filter((x) => x.id !== f.id)), 2600);
  };

  // First visit: a short "how this room works" card
  useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem(INTRO_KEY) === "1"; } catch { /* storage blocked */ }
    if (seen) return;
    const t = setTimeout(() => setShowIntro(true), 400);
    return () => clearTimeout(t);
  }, []);
  const closeIntro = () => {
    trace("intro", { action: "closed", room: room.id });
    setShowIntro(false);
    try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* storage blocked */ }
  };

  // Presence + reactions
  useEffect(() => {
    const socket = io(BACKEND_URL, { reconnection: true, reconnectionDelayMax: 5000 });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("library_join", { id: room.id, uniqueId: getUserId() });
      syncClock(socket);
    });
    socket.on("library_count", ({ id, count }: { id: string; count: number }) => {
      if (id === room.id) setCount(count);
    });
    socket.on("library_reaction", ({ emoji }: { emoji: string }) => float(emoji));
    return () => { socket.disconnect(); };
  }, [room.id]);

  // Clock: the phase is derived from the schedule; transitions trigger sounds and the summary
  useEffect(() => {
    const tick = () => {
      const t = serverNow();
      const s = librarySchedule(room, t);
      if (prevPhase.current && prevPhase.current !== s.phase) {
        if (s.phase === "break") {
          notifyFocusEnd();
          setFinishedKey(`${room.id}:${s.cycleStart}`);
        } else {
          notifyBreakEnd();
        }
      }
      prevPhase.current = s.phase;
      const sec = Math.floor(t / 1000);
      if (lastAmbientSec.current !== null && sec > lastAmbientSec.current && sec - lastAmbientSec.current < 5 && !document.hidden) {
        for (let x = lastAmbientSec.current + 1; x <= sec; x++) {
          const a = ambientReaction(room, x);
          if (a) float(a.emoji, a.left);
        }
      }
      lastAmbientSec.current = sec;
      setNow(t);
      document.title = `${fmt(s.remainingSec)} ${s.phase === "focus" ? "Focus" : "Break"} · ${room.name}`;
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [room]);

  const s = now ? librarySchedule(room, now) : null;
  const stats = useFocusCounter(s?.phase === "focus", finishedKey);
  const color = s?.phase === "break" ? "text-emerald-300" : "text-rose-300";

  const react = (emoji: string) => socketRef.current?.emit("library_react", { emoji });
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/library/${room.id}` : "";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 transition-colors duration-1000 ${s?.phase === "break" ? "bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_60%)]" : "bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.12),transparent_60%)]"}`} />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
        <Link href="/library" className="min-w-0 flex items-center gap-2 text-white/70 hover:text-white">
          <span aria-hidden>←</span> <span className="font-semibold truncate">{room.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/75">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {count === null || now === null ? "…" : `${displayedLibraryCount(room.id, count, now)} focusing`}
          </span>
          <AudioPlayer />
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
            }}
            className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-white/75"
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-16">
        {room.exam && now && (
          <p className="mb-6 px-4 py-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.08] text-sm text-amber-100 text-center">
            ⏳ <b className="font-semibold">{examCountdownText(room.exam, now)}</b> <span className="text-amber-100/60">· {examDateLabel(room.exam, now)}</span>
          </p>
        )}
        <p className={`text-sm font-semibold uppercase tracking-[0.25em] ${color}`}>{s ? (s.phase === "focus" ? "Focus" : "Break") : " "}</p>
        <div className="font-mono font-light leading-none tracking-tighter text-[clamp(4.5rem,22vw,14rem)]" style={{ fontFeatureSettings: '"tnum"' }}>
          {s ? fmt(s.remainingSec) : "--:--"}
        </div>
        <p className="mt-4 text-sm text-white/45 text-center max-w-sm">
          Silent room · {room.focusMin} min focus, {room.breakMin} min break · the timer runs on a fixed schedule for everyone
        </p>
        <NextSessionLine roomId={room.id} className="mt-2 text-center" />

        <div className="mt-10 flex items-center gap-2" aria-label="Send a reaction">
          {LIBRARY_REACTIONS.map((e) => (
            <button key={e} onClick={() => react(e)} className="w-11 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-xl transition-colors" aria-label={`Send ${e}`}>
              {e}
            </button>
          ))}
        </div>
        {stats.seconds >= 60 && (
          <p className="mt-6 text-xs text-white/40">You&apos;ve focused {Math.floor(stats.seconds / 60)} min today</p>
        )}
      </main>

      {showIntro && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="intro-title">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeIntro} />
          <div className="relative w-full max-w-sm rounded-2xl bg-neutral-900/95 border border-white/10 p-6 shadow-2xl animate-fade-in">
            <h2 id="intro-title" className="text-lg font-semibold">How this room works</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              <li className="flex gap-3"><span aria-hidden>🤫</span><span>It&apos;s silent: no chat, no names, no camera. Just you and everyone else focusing.</span></li>
              <li className="flex gap-3"><span aria-hidden>⏱️</span><span>The timer is the same for everyone and never stops. Join mid-session and just start working.</span></li>
              <li className="flex gap-3"><span aria-hidden>👋</span><span>Tap an emoji to say hi or cheer people on. Everyone sees it float up.</span></li>
              <li className="flex gap-3"><span aria-hidden>🎧</span><span>Want sound? Turn on lo-fi, rain or café noise from the music button at the top.</span></li>
            </ul>
            <button onClick={closeIntro} autoFocus className="mt-6 w-full h-11 rounded-full bg-rose-500 hover:bg-rose-400 font-medium">Start focusing</button>
          </div>
        </div>
      )}

      {/* Floating reactions from everyone in the room */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 z-20" aria-hidden>
        {floating.map((f) => (
          <span key={f.id} className="absolute bottom-10 text-3xl animate-float-up" style={{ left: `${f.left}%` }}>{f.emoji}</span>
        ))}
      </div>

      {finishedKey && finishedKey !== dismissedKey && s?.phase === "break" && (stats.lastSessionSec ?? 0) >= 60 && (
        <SessionSummary
          shareUrl={shareUrl}
          stats={stats}
          others={Math.max(0, (count ?? 1) - 1)}
          phase="break"
          onDismiss={() => setDismissedKey(finishedKey)}
          canEnableNotifications={getNotificationPermission() === "default"}
          onEnableNotifications={() => { void requestNotificationPermission(); }}
        />
      )}
    </div>
  );
}
