import { RoomSchedule } from "./types";

// Next (or ongoing) occurrence of a room's session, plus calendar exports.
// Weekday rules are evaluated in the schedule's own time zone.

const DAY = 86_400_000;

function weekdayIn(tz: string, t: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(t);
  } catch {
    return new Date(t).toUTCString().slice(0, 3);
  }
}

export function nextOccurrence(s: RoomSchedule, now: number): number | null {
  const dur = s.durationMin * 60_000;
  if (s.repeat === "none") return now < s.startsAt + dur ? s.startsAt : null;
  const step = s.repeat === "weekly" ? 7 * DAY : DAY;
  let t = s.startsAt + Math.max(0, Math.ceil((now - dur - s.startsAt) / step)) * step;
  if (s.repeat === "weekdays") {
    for (let i = 0; i < 7 && ["Sat", "Sun"].includes(weekdayIn(s.tz, t)); i++) t += DAY;
  }
  return t;
}

export const REPEAT_LABEL: Record<RoomSchedule["repeat"], string> = {
  none: "One-time",
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
};

// "Today 9:00 PM" / "Tomorrow 9:00 PM" / "Tue 12 Nov, 9:00 PM" in the viewer's time zone
export function formatWhen(t: number, now: number): string {
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(new Date(now))) / DAY);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

// Same thing in the schedule's own zone with its abbreviation (server-rendered link previews)
export function formatInZone(t: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(t);
  } catch {
    return new Date(t).toUTCString();
  }
}

// Local wall-clock time in the schedule's zone as YYYYMMDDTHHMMSS
function localStamp(t: number, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(t)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function rrule(s: RoomSchedule): string | null {
  if (s.repeat === "daily") return "RRULE:FREQ=DAILY";
  if (s.repeat === "weekly") return "RRULE:FREQ=WEEKLY";
  if (s.repeat === "weekdays") return "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  return null;
}

export function googleCalendarUrl(s: RoomSchedule, start: number, title: string, roomUrl: string): string {
  const end = start + s.durationMin * 60_000;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${localStamp(start, s.tz)}/${localStamp(end, s.tz)}`,
    ctz: s.tz,
    details: `Focus session on Pikoo. Join here: ${roomUrl}`,
    location: roomUrl,
  });
  const r = rrule(s);
  if (r) q.set("recur", r);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function icsContent(s: RoomSchedule, start: number, title: string, roomUrl: string): string {
  const end = start + s.durationMin * 60_000;
  const esc = (v: string) => v.replace(/([,;\\])/g, "\\$1");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pikoo//Focus Session//EN",
    "BEGIN:VEVENT",
    `UID:${start}-${Math.random().toString(36).slice(2)}@pikoo`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${s.tz}:${localStamp(start, s.tz)}`,
    `DTEND;TZID=${s.tz}:${localStamp(end, s.tz)}`,
    ...(rrule(s) ? [rrule(s)!] : []),
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`Focus session on Pikoo. Join here: ${roomUrl}`)}`,
    `URL:${roomUrl}`,
    `LOCATION:${esc(roomUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

// ISO week key like "2026-W46" (UTC), same as the backend
export function isoWeekKey(t: number): string {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
