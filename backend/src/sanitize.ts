const MAX_NAME_LEN = 30;
const MAX_MSG_LEN = 500;
const MAX_TODO_LEN = 200;
const MAX_SUGGESTION_LEN = 2000;
const MAX_ROOM_ID_LEN = 40;
const MAX_UNIQUE_ID_LEN = 64;

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

function trimAndClean(str: string, maxLen: number): string {
  return stripHtml(str).trim().slice(0, maxLen);
}

export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = trimAndClean(raw, MAX_NAME_LEN);
  if (clean.length === 0) return null;
  return clean;
}

export function sanitizeMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = trimAndClean(raw, MAX_MSG_LEN);
  if (clean.length === 0) return null;
  return clean;
}

export function sanitizeTodoText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = trimAndClean(raw, MAX_TODO_LEN);
  if (clean.length === 0) return null;
  return clean;
}

export function sanitizeSuggestion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = trimAndClean(raw, MAX_SUGGESTION_LEN);
  if (clean.length === 0) return null;
  return clean;
}

export function sanitizeRoomId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, MAX_ROOM_ID_LEN);
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) return null;
  return clean;
}

export function sanitizeUniqueId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, MAX_UNIQUE_ID_LEN);
  if (clean.length === 0) return null;
  return clean;
}

export function sanitizeUserSecret(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length < 16 || raw.length > 128) return null;
  return raw;
}

export function isValidTodoId(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length > 0 && raw.length < 100;
}

export function isValidBoolean(raw: unknown): raw is boolean {
  return typeof raw === "boolean";
}

export function sanitizeSettings(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  if (typeof obj.focusSec === "number") clean.focusSec = clamp(obj.focusSec, 60, 7200);
  if (typeof obj.breakSec === "number") clean.breakSec = clamp(obj.breakSec, 30, 3600);
  if (typeof obj.longBreakSec === "number") clean.longBreakSec = clamp(obj.longBreakSec, 60, 7200);
  if (typeof obj.longBreakEvery === "number") clean.longBreakEvery = clamp(Math.floor(obj.longBreakEvery), 1, 20);
  if (obj.mode === "collab" || obj.mode === "host") clean.mode = obj.mode;
  if (typeof obj.autoStart === "boolean") clean.autoStart = obj.autoStart;

  return Object.keys(clean).length > 0 ? clean : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Custom room links (/r/<slug>): 3-32 chars, lowercase letters, digits and
// single hyphens, starting and ending with a letter or digit
const RESERVED_SLUGS = new Set(["new", "create", "admin", "api", "embed", "library", "timer", "settings", "pikoo", "help", "about"]);

export function sanitizeRoomSlug(raw: unknown): { slug: string } | { error: string } | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") return { error: "Invalid link" };
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9]|-(?!-)){1,30}[a-z0-9]$/.test(slug)) {
    return { error: "Links can use 3-32 lowercase letters, numbers and hyphens" };
  }
  if (RESERVED_SLUGS.has(slug)) return { error: "That link is reserved, try another" };
  return { slug };
}

// Session schedule: start within a year, 15-480 minutes, a known repeat rule and
// a plausible IANA time zone name. Returns null to clear, undefined if invalid.
export function sanitizeSchedule(raw: unknown):
  | { startsAt: number; repeat: "none" | "daily" | "weekdays" | "weekly"; durationMin: number; tz: string }
  | null
  | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const startsAt = Number(r.startsAt);
  const durationMin = Math.round(Number(r.durationMin));
  const repeat = r.repeat;
  const tz = typeof r.tz === "string" && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(r.tz) && r.tz.length <= 64 ? r.tz : "UTC";
  const now = Date.now();
  if (!Number.isFinite(startsAt) || startsAt < now - 7 * 86_400_000 || startsAt > now + 366 * 86_400_000) return undefined;
  if (!Number.isFinite(durationMin) || durationMin < 15 || durationMin > 480) return undefined;
  if (repeat !== "none" && repeat !== "daily" && repeat !== "weekdays" && repeat !== "weekly") return undefined;
  return { startsAt, repeat, durationMin, tz };
}
