"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SessionSummary } from "@/components/GrowthCards";
import { getUserId } from "@/components/NamePrompt";
import { LibraryRoom, LIBRARY_REACTIONS, librarySchedule } from "@/lib/library";
import { serverNow, syncClock } from "@/lib/clock";
import { useFocusCounter } from "@/lib/hooks/useFocusStats";
import { notifyFocusEnd, notifyBreakEnd, getNotificationPermission, requestNotificationPermission } from "@/lib/audio";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

interface Floating { id: number; emoji: string; left: number }

export function LibraryRoomView({ room }: { room: LibraryRoom }) {
  const socketRef = useRef<Socket | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [floating, setFloating] = useState<Floating[]>([]);
  const [finishedKey, setFinishedKey] = useState<string | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const prevPhase = useRef<"focus" | "break" | null>(null);

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
    socket.on("library_reaction", ({ emoji }: { emoji: string }) => {
      const f = { id: Math.random(), emoji, left: 10 + Math.random() * 80 };
      setFloating((list) => [...list.slice(-20), f]);
      setTimeout(() => setFloating((list) => list.filter((x) => x.id !== f.id)), 2600);
    });
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
        <Link href="/library" className="flex items-center gap-2 text-white/70 hover:text-white">
          <span aria-hidden>←</span> <span className="font-semibold">{room.name}</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/75">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {count === null ? "…" : `${count} focusing`}
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
        <p className={`text-sm font-semibold uppercase tracking-[0.25em] ${color}`}>{s ? (s.phase === "focus" ? "Focus" : "Break") : " "}</p>
        <div className="font-mono font-light leading-none tracking-tighter text-[clamp(4.5rem,22vw,14rem)]" style={{ fontFeatureSettings: '"tnum"' }}>
          {s ? fmt(s.remainingSec) : "--:--"}
        </div>
        <p className="mt-4 text-sm text-white/45 text-center max-w-sm">
          Silent room · {room.focusMin} min focus, {room.breakMin} min break · the timer runs on a fixed schedule for everyone
        </p>

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

      {/* Floating reactions from everyone in the room */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 z-20" aria-hidden>
        {floating.map((f) => (
          <span key={f.id} className="absolute bottom-10 text-3xl animate-float-up" style={{ left: `${f.left}%` }}>{f.emoji}</span>
        ))}
      </div>

      {finishedKey && finishedKey !== dismissedKey && s?.phase === "break" && (
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
