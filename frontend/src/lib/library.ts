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
