// Silent library rooms (mirrors backend/src/library.ts). The timer is pure
// arithmetic on the clock, so every visitor computes the same phase with no
// server state: cycles divide an hour evenly and start on the hour (UTC).

export interface ExamInfo {
  name: string;       // "JEE Main 2027"
  short: string;      // "JEE Main"
  date: string;       // first exam day, YYYY-MM-DD (India)
  dateLabel: string;  // "20 Jan 2027 (Session 1)"
  confirmed: boolean; // false = expected date, not yet announced officially
}

export interface LibraryRoom {
  id: string;
  name: string;
  focusMin: number;
  breakMin: number;
  blurb: string;
  exam?: ExamInfo;
}

export const LIBRARY_ROOMS: LibraryRoom[] = [
  { id: "pomodoro", name: "Pomodoro Hall", focusMin: 25, breakMin: 5, blurb: "Classic 25/5 Pomodoros, starting on the hour and half hour." },
  { id: "deep-work", name: "Deep Work Library", focusMin: 50, breakMin: 10, blurb: "Long 50-minute blocks for reading, writing and problem sets." },
  { id: "quick-sprints", name: "Quick Sprints", focusMin: 15, breakMin: 5, blurb: "Short 15-minute sprints for getting started when it's hard." },
  // Exam rooms: permanent silent rooms with a countdown to the exam.
  // Dates checked 2026-11-11; update when the official notices change.
  {
    id: "jee-main-2027", name: "JEE Main 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for JEE Main 2027.",
    exam: { name: "JEE Main 2027", short: "JEE Main", date: "2027-01-20", dateLabel: "20 Jan 2027 (Session 1)", confirmed: true },
  },
  {
    id: "neet-2027", name: "NEET 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for NEET UG 2027.",
    exam: { name: "NEET UG 2027", short: "NEET", date: "2027-05-02", dateLabel: "2 May 2027 (expected)", confirmed: false },
  },
  {
    id: "upsc-prelims-2027", name: "UPSC Prelims 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for UPSC CSE Prelims 2027.",
    exam: { name: "UPSC Prelims 2027", short: "UPSC Prelims", date: "2027-05-23", dateLabel: "23 May 2027", confirmed: true },
  },
];

export const STUDY_ROOMS = LIBRARY_ROOMS.filter((r) => !r.exam);
export const EXAM_ROOMS = LIBRARY_ROOMS.filter((r) => r.exam);

// Whole days left until the exam's first day (midnight India time)
export function daysToExam(exam: ExamInfo, now: number): number {
  const start = Date.parse(`${exam.date}T00:00:00+05:30`);
  return Math.ceil((start - now) / 86_400_000);
}

export function examCountdownText(exam: ExamInfo, now: number): string {
  const d = daysToExam(exam, now);
  if (d > 1) return `${d} days to ${exam.short}`;
  if (d === 1) return `${exam.short} is tomorrow`;
  if (d === 0) return `${exam.short} starts today. Good luck!`;
  return `${exam.short} has started. Good luck!`;
}

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
// to see how new visitors react, plus matching ambient emoji reactions
// (ambientReaction below). Real people are added on top. Both are derived from
// the room id and the clock, so every viewer sees the same thing. Set to false
// to go back to real counts and real reactions only.
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

// Ambient reactions that fit the moment, one decision per room per second:
// a cheer burst when focus ends, coffee during the break, "let's go" right
// before and after focus starts, and the odd 🔥 in the middle of a session.
type Mix = [emoji: string, weight: number][];
function pick(mix: Mix, r: number): string {
  const total = mix.reduce((a, [, w]) => a + w, 0);
  let x = r * total;
  for (const [e, w] of mix) if ((x -= w) < 0) return e;
  return mix[mix.length - 1][0];
}

export function ambientReaction(room: LibraryRoom, sec: number): { emoji: string; left: number } | null {
  if (!SEEDED_LIBRARY_COUNTS) return null;
  const t = sec * 1000;
  const s = librarySchedule(room, t);
  const into = (t - s.cycleStart) / 1000; // seconds since this cycle's focus started
  const focusSec = room.focusMin * 60;
  const breakInto = into - focusSec;
  const left = s.remainingSec;
  let p: number;
  let mix: Mix;
  if (s.phase === "break" && breakInto < 40) { p = 0.35; mix = [["🎉", 6], ["☕", 3], ["🔥", 1]]; }
  else if (s.phase === "break" && left <= 30) { p = 0.12; mix = [["💪", 7], ["🔥", 3]]; }
  else if (s.phase === "break") { p = 0.05; mix = [["☕", 6], ["👋", 4]]; }
  else if (into < 60) { p = 0.15; mix = [["👋", 4], ["💪", 4], ["🔥", 2]]; }
  else if (left <= 120) { p = 0.03; mix = [["🔥", 6], ["💪", 4]]; }
  else { p = 0.013; mix = [["🔥", 5], ["💪", 4], ["👋", 1]]; }
  if (seeded(`${room.id}:r:${sec}`) >= p) return null;
  return { emoji: pick(mix, seeded(`${room.id}:e:${sec}`)), left: 10 + seeded(`${room.id}:x:${sec}`) * 80 };
}
