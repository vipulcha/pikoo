"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { PHASE_LABELS, SOCKET_EVENTS, TimerState, UserTodos } from "@/lib/types";
import { serverNow, syncClock } from "@/lib/clock";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const PHASE_COLOR = { focus: "#fb7185", break: "#34d399", long_break: "#60a5fa" } as const;

function remainingSec(t: TimerState): number {
  if (!t.running || !t.phaseEndsAt) return t.remainingSecWhenPaused;
  return Math.max(0, Math.ceil((t.phaseEndsAt - serverNow()) / 1000));
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// View-only timer for stream overlays (OBS browser source) and Notion embeds.
// ?bg=transparent for OBS, ?link=0 hides the join link, ?goal=0 hides the room
// creator's current task. It can't control the room and doesn't count as a person in it.
export default function EmbedTimer({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const search = useSearchParams();
  const transparent = search.get("bg") === "transparent";
  const showLink = search.get("link") !== "0";
  const showGoal = search.get("goal") !== "0";

  const [timer, setTimer] = useState<TimerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only task lists their owners made visible to others ever reach a spectator
  const [todos, setTodos] = useState<Record<string, UserTodos>>({});
  const [hostId, setHostId] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const prev = document.body.style.background;
    if (transparent) document.body.style.background = "transparent";
    return () => { document.body.style.background = prev; };
  }, [transparent]);

  useEffect(() => {
    const socket: Socket = io(BACKEND_URL, { reconnection: true, reconnectionDelayMax: 5000 });
    const spectate = () => {
      socket.emit(SOCKET_EVENTS.SPECTATE_ROOM, { roomId });
      syncClock(socket);
    };
    socket.on("connect", spectate);
    socket.on(SOCKET_EVENTS.ROOM_STATE, (state: { timer: TimerState; userTodos?: Record<string, UserTodos>; hostId?: string | null }) => {
      setTimer(state.timer);
      setTodos(state.userTodos ?? {});
      setHostId(state.hostId ?? null);
      setError(null);
    });
    socket.on(SOCKET_EVENTS.TODOS_UPDATE, ({ userTodos }: { userTodos?: Record<string, UserTodos> }) => setTodos(userTodos ?? {}));
    socket.on(SOCKET_EVENTS.TIMER_UPDATE, ({ timer }: { timer: TimerState }) => setTimer(timer));
    socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => setError(message));
    return () => { socket.disconnect(); };
  }, [roomId]);

  useEffect(() => {
    if (!timer?.running) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [timer?.running]);

  const host = typeof window !== "undefined" ? window.location.host : "";
  // The streamer created the room (from /obs), so the creator's picked task is "what I'm working on"
  const list = hostId ? todos[hostId] : undefined;
  const goal = list?.todos.find((t) => t.id === list.activeTodoId && !t.completed);
  const done = list?.todos.filter((t) => t.completed).length ?? 0;

  return (
    <main
      className={`h-screen w-full overflow-hidden flex items-center justify-center p-4 ${transparent ? "" : "bg-black"}`}
      style={{ textShadow: transparent ? "0 2px 12px rgba(0,0,0,0.6)" : undefined }}
    >
      {error ? (
        <p className="text-white/60 text-sm">{error === "Room not found" ? "This room has expired." : error}</p>
      ) : !timer ? (
        <p className="text-white/40 text-sm">Connecting…</p>
      ) : (
        <div className="flex flex-col items-center text-white select-none">
          <div className="flex items-center gap-2 text-[clamp(0.7rem,3.5vw,1rem)] font-semibold uppercase tracking-[0.2em]" style={{ color: PHASE_COLOR[timer.phase] }}>
            <span className={`inline-block w-2 h-2 rounded-full ${timer.running ? "animate-pulse" : "opacity-40"}`} style={{ background: PHASE_COLOR[timer.phase] }} />
            {PHASE_LABELS[timer.phase]}
            {timer.cycleCount > 0 && <span className="text-white/40">#{timer.cycleCount}</span>}
            {!timer.running && <span className="text-white/40">· paused</span>}
          </div>
          <div className="font-mono font-light leading-none tracking-tighter text-[clamp(2.5rem,min(26vw,48vh),12rem)]" style={{ fontFeatureSettings: '"tnum"' }}>
            {fmt(remainingSec(timer))}
          </div>
          {showGoal && goal && list && (
            <p className="mt-1 mb-1 flex max-w-[92vw] items-baseline gap-1.5 text-[clamp(0.75rem,3.6vw,1.15rem)] text-white/90">
              <span className="shrink-0 text-white/50">Working on:</span>
              <span className="min-w-0 truncate">{goal.text}</span>
              <span className="shrink-0 text-white/50">· {done}/{list.todos.length} done</span>
            </p>
          )}
          {showLink && (
            <a
              href={`/r/${roomId}?ref=${transparent ? "obs" : "embed"}`}
              target="_blank"
              rel="noopener"
              className="mt-2 text-[clamp(0.65rem,3vw,0.9rem)] text-white/50 hover:text-white/80"
            >
              Focus with us · {host}/r/{roomId}
            </a>
          )}
        </div>
      )}
    </main>
  );
}
