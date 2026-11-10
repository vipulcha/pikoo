// ============================================
// Anonymous daily usage counters
// ============================================
// Counts events per UTC day (no names, no IPs, no message text). Unique users are
// counted with a HyperLogLog of the random per-browser uniqueId, so individual
// ids can't be read back. Kept for 90 days in Redis, in memory otherwise.

import { getRedis } from "./store.js";
import { log } from "./logger.js";

export type StatEvent =
  | "rooms_created"
  | "room_joins"
  | "focus_completed"
  | "time_added"
  | "messages_sent"
  | "embed_views";

const RETENTION_SEC = 60 * 60 * 24 * 90;
const memory = new Map<string, Map<string, number>>();
const memoryUsers = new Map<string, Set<string>>();

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export function track(event: StatEvent, uniqueId?: string): void {
  const d = day();
  const redis = getRedis();
  if (redis) {
    const key = `stats:${d}`;
    const pipe = redis.multi().hincrby(key, event, 1).expire(key, RETENTION_SEC);
    if (uniqueId) pipe.pfadd(`${key}:users`, uniqueId).expire(`${key}:users`, RETENTION_SEC);
    pipe.exec().catch((err) => log.store.warn("Stats write failed", { error: String(err) }));
    return;
  }
  const counts = memory.get(d) ?? new Map<string, number>();
  counts.set(event, (counts.get(event) ?? 0) + 1);
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
