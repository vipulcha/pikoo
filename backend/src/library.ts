// ============================================
// Silent library: public rooms nobody has to moderate
// ============================================
// The timer follows a fixed clock schedule (no one can pause, skip or reset it),
// there is no chat and no names, only a live headcount and a few fixed emoji
// reactions. Each cycle divides an hour evenly, so sessions start on the hour.

import { Server, Socket } from "socket.io";
import { track, logJoin, logVisitor, formatStay } from "./stats.js";

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

export function setupLibraryHandlers(io: Server, socket: Socket, rateLimited: (s: Socket) => boolean) {
  let lastReactionAt = 0;

  socket.on("library_join", async (payload: { id?: unknown; uniqueId?: unknown }) => {
    if (rateLimited(socket)) return;
    const room = LIBRARY_ROOMS.find((r) => r.id === payload?.id);
    if (!room) return;
    const prev = socket.data.libraryRoom as string | undefined;
    if (prev === room.id) return;
    if (prev) {
      logVisitor(socket.data.uniqueId, `🚪 left silent room ${prev} after ${formatStay(Date.now() - (socket.data.libraryJoinedAt ?? Date.now()))}`);
      socket.leave(channel(prev));
      await broadcastCount(io, prev);
    }
    const uid = typeof payload?.uniqueId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(payload.uniqueId) ? payload.uniqueId : undefined;
    if (uid) socket.data.uniqueId = uid; // also counts toward "people focusing right now"
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
      logVisitor(socket.data.uniqueId, `🚪 left silent room ${id} after ${formatStay(Date.now() - (socket.data.libraryJoinedAt ?? Date.now()))}`);
      broadcastCount(io, id).catch(() => {});
    }
  });
}
