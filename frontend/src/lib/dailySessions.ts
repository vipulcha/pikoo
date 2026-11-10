import { RoomSchedule } from "./types";

// Fixed daily group sessions in the public Pomodoro room, so newcomers know
// when other people will be there. Times are wall-clock in their own zone
// (DST-safe), and land on the room's half-hour cycle boundaries.

export interface DailySession {
  id: string;
  label: string;
  hour: number;
  minute: number;
  tz: string;
  tzLabel: string;
  durationMin: number;
  roomId: string;
}

export const DAILY_SESSIONS: DailySession[] = [
  { id: "morning-ist", label: "Early morning focus", hour: 6, minute: 0, tz: "Asia/Kolkata", tzLabel: "IST", durationMin: 120, roomId: "pomodoro" },
  { id: "evening-ist", label: "Night study session", hour: 21, minute: 0, tz: "Asia/Kolkata", tzLabel: "IST", durationMin: 120, roomId: "pomodoro" },
  { id: "evening-us", label: "US evening session", hour: 20, minute: 0, tz: "America/New_York", tzLabel: "ET", durationMin: 120, roomId: "pomodoro" },
];

const DAY = 86_400_000;

// Offset (ms) of a zone from UTC at instant t
function zoneOffset(tz: string, t: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(t)
      .map((x) => [x.type, x.value])
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - (t - (t % 1000));
}

// Instant of hour:minute in tz on the calendar day (in tz) containing t
function wallClockOn(s: DailySession, t: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: s.tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(t).map((x) => [x.type, x.value])
  );
  const guess = Date.UTC(+p.year, +p.month - 1, +p.day, s.hour, s.minute);
  return guess - zoneOffset(s.tz, guess - zoneOffset(s.tz, guess));
}

/** The current or next run of a session: start time and whether it's live now */
export function sessionWindow(s: DailySession, now: number): { start: number; end: number; live: boolean } {
  const dur = s.durationMin * 60_000;
  for (const d of [-1, 0, 1, 2]) {
    const start = wallClockOn(s, now + d * DAY);
    if (start + dur > now) return { start, end: start + dur, live: start <= now };
  }
  const start = wallClockOn(s, now + DAY);
  return { start, end: start + dur, live: false };
}

/** Sessions ordered by which is live or comes up first */
export function upcomingSessions(now: number) {
  return DAILY_SESSIONS.map((s) => ({ session: s, ...sessionWindow(s, now) })).sort((a, b) => a.start - b.start);
}

export const asSchedule = (s: DailySession, start: number): RoomSchedule => ({ startsAt: start, repeat: "daily", durationMin: s.durationMin, tz: s.tz });

export function formatCountdown(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}
