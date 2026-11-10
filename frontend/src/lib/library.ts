// Silent library rooms (mirrors backend/src/library.ts). The timer is pure
// arithmetic on the clock, so every visitor computes the same phase with no
// server state: cycles divide an hour evenly and start on the hour (UTC).

export interface LibraryRoom {
  id: string;
  name: string;
  focusMin: number;
  breakMin: number;
  blurb: string;
}

export const LIBRARY_ROOMS: LibraryRoom[] = [
  { id: "pomodoro", name: "Pomodoro Hall", focusMin: 25, breakMin: 5, blurb: "Classic 25/5 Pomodoros, starting on the hour and half hour." },
  { id: "deep-work", name: "Deep Work Library", focusMin: 50, breakMin: 10, blurb: "Long 50-minute blocks for reading, writing and problem sets." },
  { id: "quick-sprints", name: "Quick Sprints", focusMin: 15, breakMin: 5, blurb: "Short 15-minute sprints for getting started when it's hard." },
];

export const LIBRARY_REACTIONS = ["👋", "🔥", "💪", "☕", "🎉"] as const;

export const getLibraryRoom = (id: string) => LIBRARY_ROOMS.find((r) => r.id === id);

export function librarySchedule(room: LibraryRoom, now: number) {
  const focusMs = room.focusMin * 60_000;
  const cycleMs = (room.focusMin + room.breakMin) * 60_000;
  const cycleStart = now - (now % cycleMs);
  const inFocus = now - cycleStart < focusMs;
  const endsAt = cycleStart + (inFocus ? focusMs : cycleMs);
  return {
    phase: inFocus ? ("focus" as const) : ("break" as const),
    endsAt,
    remainingSec: Math.max(0, Math.ceil((endsAt - now) / 1000)),
    cycleStart,
  };
}

// TEMPORARY experiment: show a made-up 100–200 headcount in the silent rooms
// to see how new visitors react. Real people in the room are added on top.
// The number is the same for every viewer and drifts slowly (it's derived from
// the room id and the clock). Set to false to go back to real counts only.
export const SEEDED_LIBRARY_COUNTS = true;

function seeded(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function displayedLibraryCount(roomId: string, real: number, now: number): number {
  if (!SEEDED_LIBRARY_COUNTS) return real;
  const step = 10 * 60_000;
  const k = Math.floor(now / step);
  const f = (now % step) / step;
  const a = seeded(`${roomId}:${k}`);
  const b = seeded(`${roomId}:${k + 1}`);
  return 100 + Math.round((a + (b - a) * f) * 100) + real;
}
