// ============================================
// Anonymous daily usage counters
// ============================================
// Counts events per UTC day (no names, no IPs, no message text). Unique users are
// counted with a HyperLogLog of the random per-browser uniqueId, so individual
// ids can't be read back. Kept for 90 days in Redis, in memory otherwise.

import { createHash } from "node:crypto";
import { getRedis } from "./store.js";
import { log } from "./logger.js";

export type StatEvent =
  | "rooms_created"
  | "room_joins"
  | "focus_completed"
  | "time_added"
  | "messages_sent"
  | "embed_views"
  | "library_joins"
  | "schedules_set"
  | "focus_minutes"; // person-minutes of completed focus (minutes x people present)

const RETENTION_SEC = 60 * 60 * 24 * 90;
const memory = new Map<string, Map<string, number>>();
const memoryUsers = new Map<string, Set<string>>();

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

const memoryTotals = new Map<string, number>();

export function track(event: StatEvent, uniqueId?: string, amount = 1): void {
  const d = day();
  const redis = getRedis();
  if (redis) {
    const key = `stats:${d}`;
    const pipe = redis.multi().hincrby(key, event, amount).expire(key, RETENTION_SEC).hincrby("stats:total", event, amount);
    if (uniqueId) pipe.pfadd(`${key}:users`, uniqueId).expire(`${key}:users`, RETENTION_SEC);
    pipe.exec().catch((err) => log.store.warn("Stats write failed", { error: String(err) }));
    return;
  }
  memoryTotals.set(event, (memoryTotals.get(event) ?? 0) + amount);
  const counts = memory.get(d) ?? new Map<string, number>();
  counts.set(event, (counts.get(event) ?? 0) + amount);
  memory.set(d, counts);
  if (uniqueId) {
    const users = memoryUsers.get(d) ?? new Set<string>();
    users.add(uniqueId);
    memoryUsers.set(d, users);
  }
}

export interface DailyStats {
  date: string;
  unique_users: number;
  [event: string]: number | string;
}

export async function readDailyStats(days: number): Promise<DailyStats[]> {
  const out: DailyStats[] = [];
  const redis = getRedis();
  for (let i = 0; i < days; i++) {
    const d = day(Date.now() - i * 86_400_000);
    if (redis) {
      const [counts, users] = await Promise.all([redis.hgetall(`stats:${d}`), redis.pfcount(`stats:${d}:users`)]);
      const row: DailyStats = { date: d, unique_users: users };
      for (const [k, v] of Object.entries(counts)) row[k] = Number(v);
      out.push(row);
    } else {
      const row: DailyStats = { date: d, unique_users: memoryUsers.get(d)?.size ?? 0 };
      for (const [k, v] of memory.get(d) ?? []) row[k] = v;
      out.push(row);
    }
  }
  return out;
}

// All-time totals since counting started (shown on the homepage).
// The baseline carries over the "300+ sessions" figure the site already showed
// before these counters existed; override with STATS_BASELINE_SESSIONS.
const BASELINE_SESSIONS = Number(process.env.STATS_BASELINE_SESSIONS ?? 300) || 0;

export async function readTotals(): Promise<{ focusSessions: number; focusHours: number; roomsCreated: number }> {
  const redis = getRedis();
  const raw: Record<string, string | number> = redis ? await redis.hgetall("stats:total") : Object.fromEntries(memoryTotals);
  const n = (k: string) => Number(raw[k] ?? 0) || 0;
  return {
    focusSessions: n("focus_completed") + BASELINE_SESSIONS,
    focusHours: Math.floor(n("focus_minutes") / 60),
    roomsCreated: n("rooms_created"),
  };
}

// "Is this the first time we've seen this browser?" for the readable join logs.
// Stores only a short hash of the random per-browser id (90-day expiry), so the
// id itself still can't be read back.
const memorySeen = new Set<string>();

export async function isNewVisitor(uniqueId: string | undefined): Promise<boolean | null> {
  if (!uniqueId) return null;
  const hash = createHash("sha256").update(uniqueId).digest("hex").slice(0, 16);
  const redis = getRedis();
  if (!redis) {
    if (memorySeen.has(hash)) return false;
    memorySeen.add(hash);
    return true;
  }
  try {
    return (await redis.set(`seen:${hash}`, "1", "EX", RETENTION_SEC, "NX")) === "OK";
  } catch {
    return null;
  }
}

// ---- Visitor trace -------------------------------------------------------
// Every line about one browser starts with the same short tag, e.g. [v3f9a2c]
// or [v3f9a2c Riya], so a visitor's whole visit can be read top to bottom in
// the logs (search the tag). The tag is a hash of the random browser id: no
// names beyond what people type into rooms, no IPs.
export function visitorTag(uniqueId: string | undefined, name?: string): string {
  const tag = uniqueId ? "v" + createHash("sha256").update(uniqueId).digest("hex").slice(0, 6) : "v??????";
  return `[${tag}${name && name !== "Anonymous" ? ` ${name}` : ""}]`;
}

export function logVisitor(uniqueId: string | undefined, msg: string, name?: string): void {
  log.visitors.info(`${visitorTag(uniqueId, name)} ${msg}`);
}

export function formatStay(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// One easy-to-spot line per join, e.g. "[v3f9a2c Riya] 👋 NEW person joined room physics-group"
export async function logJoin(where: string, uniqueId: string | undefined, name?: string): Promise<void> {
  const isNew = await isNewVisitor(uniqueId);
  const who = isNew === true ? "👋 NEW person" : isNew === false ? "↩️ Returning person" : "Someone";
  logVisitor(uniqueId, `${who} joined ${where}`, name);
}
