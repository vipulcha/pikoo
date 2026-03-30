const MAX_NAME_LEN = 30;
const MAX_MSG_LEN = 500;
const MAX_TODO_LEN = 200;
const MAX_ROOM_ID_LEN = 21;
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

  return Object.keys(clean).length > 0 ? clean : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
