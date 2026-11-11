// Silent library rooms (mirrors backend/src/library.ts). The timer is pure
// arithmetic on the clock, so every visitor computes the same phase with no
// server state: cycles divide an hour evenly and start on the hour (UTC).

export interface ExamInfo {
  name: string;        // "JEE Main 2027"
  short: string;       // "JEE Main"
  dates: string[];     // first day of each sitting, YYYY-MM-DD; the countdown targets the next one
  utcOffset: string;   // offset where the exam is held, e.g. "+05:30"
  note?: string;       // shown after the date, e.g. "Session 1" or "expected"
  region: "india" | "international";
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
    exam: { name: "JEE Main 2027", short: "JEE Main", dates: ["2027-01-20"], utcOffset: "+05:30", note: "Session 1", region: "india" },
  },
  {
    id: "neet-2027", name: "NEET 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for NEET UG 2027.",
    exam: { name: "NEET UG 2027", short: "NEET", dates: ["2027-05-02"], utcOffset: "+05:30", note: "expected", region: "india" },
  },
  {
    id: "upsc-prelims-2027", name: "UPSC Prelims 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for UPSC CSE Prelims 2027.",
    exam: { name: "UPSC Prelims 2027", short: "UPSC Prelims", dates: ["2027-05-23"], utcOffset: "+05:30", region: "india" },
  },
  {
    id: "sat", name: "SAT Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for the next SAT.",
    exam: { name: "SAT", short: "the SAT", dates: ["2026-12-05", "2027-03-06", "2027-05-01", "2027-06-05"], utcOffset: "-05:00", note: "next test", region: "international" },
  },
  {
    id: "ap-exams-2027", name: "AP Exams 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for AP Exams in May 2027.",
    exam: { name: "AP Exams 2027", short: "AP Exams", dates: ["2027-05-03"], utcOffset: "-05:00", region: "international" },
  },
  {
    id: "gcse-a-levels-2027", name: "GCSE & A-level 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone revising for GCSEs and A-levels 2027.",
    exam: { name: "GCSEs & A-levels 2027", short: "GCSEs & A-levels", dates: ["2027-05-10"], utcOffset: "+01:00", region: "international" },
  },
  {
    id: "ib-exams-2027", name: "IB Exams May 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for the IB May 2027 session.",
    exam: { name: "IB May 2027", short: "IB exams", dates: ["2027-04-23"], utcOffset: "+00:00", region: "international" },
  },
  {
    id: "bar-exam-feb-2027", name: "Bar Exam Feb 2027 Room", focusMin: 50, breakMin: 10,
    blurb: "50-minute blocks with everyone preparing for the February 2027 bar exam.",
    exam: { name: "February 2027 Bar Exam", short: "the bar exam", dates: ["2027-02-23"], utcOffset: "-05:00", note: "UBE", region: "international" },
  },
];

export const STUDY_ROOMS = LIBRARY_ROOMS.filter((r) => !r.exam);
export const EXAM_ROOMS = LIBRARY_ROOMS.filter((r) => r.exam);
export const examRooms = (region: ExamInfo["region"]) => EXAM_ROOMS.filter((r) => r.exam?.region === region);

const DAY = 86_400_000;
const examStart = (exam: ExamInfo, date: string) => Date.parse(`${date}T00:00:00${exam.utcOffset}`);

// The sitting the countdown points at: the first one that hasn't finished its first day
export function nextExamStart(exam: ExamInfo, now: number): number {
  const starts = exam.dates.map((d) => examStart(exam, d));
  return starts.find((t) => t + DAY > now) ?? starts[starts.length - 1];
}

export function examDateLabel(exam: ExamInfo, now: number): string {
  const t = nextExamStart(exam, now);
  const d = new Date(t + 12 * 3_600_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return exam.note ? `${d} (${exam.note})` : d;
}

export function examCountdownText(exam: ExamInfo, now: number): string {
  const d = Math.ceil((nextExamStart(exam, now) - now) / DAY);
  const cap = exam.short.charAt(0).toUpperCase() + exam.short.slice(1);
  if (d > 1) return `${d} days to ${exam.short}`;
  if (d === 1) return `${cap}: tomorrow. Good luck!`;
  if (d === 0) return "Exam day is today. Good luck!";
  return "Exams are underway. Good luck!";
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
