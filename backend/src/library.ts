// ============================================
// Silent library: public rooms nobody has to moderate
// ============================================
// The timer follows a fixed clock schedule (no one can pause, skip or reset it),
// there is no chat and no names, only a live headcount and a few fixed emoji
// reactions. Each cycle divides an hour evenly, so sessions start on the hour.

import { Server, Socket } from "socket.io";
import { track, logJoin, logVisitor, formatStay, markCrawler, isCrawler } from "./stats.js";
import { getRedis } from "./store.js";

export interface LibraryRoom {
  id: string;
  name: string;
  focusMin: number;
  breakMin: number;
}

export const LIBRARY_ROOMS: LibraryRoom[] = [
  { id: "pomodoro", name: "Pomodoro Hall", focusMin: 25, breakMin: 5 },
  { id: "deep-work", name: "Deep Work Library", focusMin: 50, breakMin: 10 },
  { id: "quick-sprints", name: "Quick Sprints", focusMin: 15, breakMin: 5 },
  // Exam rooms (countdowns live in the frontend)
  { id: "jee-main-2027", name: "JEE Main 2027 Room", focusMin: 50, breakMin: 10 },
  { id: "neet-2027", name: "NEET 2027 Room", focusMin: 50, breakMin: 10 },
  { id: "upsc-prelims-2027", name: "UPSC Prelims 2027 Room", focusMin: 50, breakMin: 10 },
  { id: "sat", name: "SAT Room", focusMin: 50, breakMin: 10 },
  { id: "ap-exams-2027", name: "AP Exams 2027 Room", focusMin: 50, breakMin: 10 },
  { id: "gcse-a-levels-2027", name: "GCSE & A-level 2027 Room", focusMin: 50, breakMin: 10 },
  { id: "ib-exams-2027", name: "IB Exams May 2027 Room", focusMin: 50, breakMin: 10 },
  { id: "bar-exam-feb-2027", name: "Bar Exam Feb 2027 Room", focusMin: 50, breakMin: 10 },
];

export const LIBRARY_REACTIONS = ["👋", "🔥", "💪", "☕", "🎉"] as const;

const channel = (id: string) => `library:${id}`;

export async function libraryCount(io: Server, id: string): Promise<number> {
  const people = new Set<string>();
  for (const s of await io.in(channel(id)).fetchSockets()) people.add(s.data.uniqueId || s.id);
  return people.size;
}

async function broadcastCount(io: Server, id: string) {
  io.to(channel(id)).emit("library_count", { id, count: await libraryCount(io, id) });
}

// "N people focused here this week": browsers that stayed at least 10 minutes in
// a room, kept per UTC day as a HyperLogLog (ids can't be read back) for 8 days.
// The page only shows the number once it's big enough to mean something.
const FOCUSED_MIN_MS = 10 * 60_000;
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const focusedKey = (id: string, day: string) => `library:focused:${id}:${day}`;
const memoryFocused = new Map<string, Set<string>>();

function recordStay(socket: Socket, id: string) {
  const uid = socket.data.uniqueId as string | undefined;
  const stayed = Date.now() - ((socket.data.libraryJoinedAt as number | undefined) ?? Date.now());
  logVisitor(uid, `🚪 left silent room ${id} after ${formatStay(stayed)}`);
  if (!uid || stayed < FOCUSED_MIN_MS || isCrawler(uid)) return;
  const key = focusedKey(id, utcDay(Date.now()));
  const redis = getRedis();
  if (redis) {
    redis.multi().pfadd(key, uid).expire(key, 8 * 86_400).exec().catch(() => {});
    return;
  }
  if (memoryFocused.size > 1000) memoryFocused.clear();
  const people = memoryFocused.get(key) ?? new Set<string>();
  people.add(uid);
  memoryFocused.set(key, people);
}

export async function focusedThisWeek(id: string): Promise<number> {
  const [first, ...rest] = Array.from({ length: 7 }, (_, i) => focusedKey(id, utcDay(Date.now() - i * 86_400_000)));
  const redis = getRedis();
  if (redis) return redis.pfcount(first, ...rest).catch(() => 0);
  const people = new Set<string>();
  for (const key of [first, ...rest]) for (const uid of memoryFocused.get(key) ?? []) people.add(uid);
  return people.size;
}

export function setupLibraryHandlers(io: Server, socket: Socket, rateLimited: (s: Socket) => boolean) {
  let lastReactionAt = 0;

  socket.on("library_join", async (payload: { id?: unknown; uniqueId?: unknown }) => {
    if (rateLimited(socket)) return;
    const room = LIBRARY_ROOMS.find((r) => r.id === payload?.id);
    if (!room) return;
    const prev = socket.data.libraryRoom as string | undefined;
    if (prev === room.id) return;
    if (prev) {
      recordStay(socket, prev);
      socket.leave(channel(prev));
      await broadcastCount(io, prev);
    }
    const uid = typeof payload?.uniqueId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(payload.uniqueId) ? payload.uniqueId : undefined;
    if (uid) socket.data.uniqueId = uid; // also counts toward "people focusing right now"
    markCrawler(uid, socket.handshake.headers["user-agent"]);
    socket.data.libraryRoom = room.id;
    socket.data.libraryJoinedAt = Date.now();
    socket.join(channel(room.id));
    track("library_joins", uid);
    void logJoin(`silent room ${room.id}`, uid);
    await broadcastCount(io, room.id);
  });

  socket.on("library_react", (payload: { emoji?: unknown }) => {
    const id = socket.data.libraryRoom as string | undefined;
    if (!id) return;
    if (!LIBRARY_REACTIONS.includes(payload?.emoji as (typeof LIBRARY_REACTIONS)[number])) return;
    const now = Date.now();
    if (now - lastReactionAt < 3000) return; // one reaction per 3s per person
    lastReactionAt = now;
    io.to(channel(id)).emit("library_reaction", { emoji: payload.emoji });
    logVisitor(socket.data.uniqueId, `${payload.emoji} reacted in silent room ${id}`);
  });

  socket.on("disconnect", () => {
    const id = socket.data.libraryRoom as string | undefined;
    if (id) {
      recordStay(socket, id);
      broadcastCount(io, id).catch(() => {});
    }
  });
}
