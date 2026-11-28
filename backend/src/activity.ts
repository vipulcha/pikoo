// ============================================
// Recent visitor activity, for the developer's dashboard (/dashboard)
// ============================================
// The same lines as the "visitors" log (people only, no crawlers), kept for 7
// days in memory and in Redis, so a restart or deploy doesn't empty the feed.
// Each line carries the visitor's short hashed tag, never the browser id itself.

import { getRedis } from "./store.js";
import { log } from "./logger.js";

export interface ActivityEvent {
  t: number;      // epoch ms
  v: string;      // visitor tag, e.g. "v3f9a2c"
  name?: string;  // name typed into a room, if any
  msg: string;
}

const KEY = "activity";
export const ACTIVITY_KEEP_MS = 7 * 86_400_000;
const MAX_EVENTS = 8000;

let events: ActivityEvent[] = []; // oldest first

function trim(now = Date.now()) {
  const cutoff = now - ACTIVITY_KEEP_MS;
  let drop = 0;
  while (drop < events.length && events[drop].t < cutoff) drop++;
  if (drop) events = events.slice(drop);
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
}

export function recordActivity(v: string, name: string | undefined, msg: string): void {
  const e: ActivityEvent = { t: Date.now(), v, msg: msg.slice(0, 300), ...(name && name !== "Anonymous" ? { name } : {}) };
  events.push(e);
  trim(e.t);
  const redis = getRedis();
  if (redis) {
    redis.multi().rpush(KEY, JSON.stringify(e)).ltrim(KEY, -MAX_EVENTS, -1).exec()
      .catch((err) => log.store.warn("Activity write failed", { error: String(err) }));
  }
}

/** On startup: bring back the last 7 days from Redis (merged with anything logged meanwhile) */
export async function loadActivity(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const raw = await redis.lrange(KEY, 0, -1);
    const stored: ActivityEvent[] = [];
    for (const line of raw) {
      try { stored.push(JSON.parse(line)); } catch { /* skip a bad line */ }
    }
    const since = events.length ? events[0].t : Infinity;
    events = [...stored.filter((e) => e.t < since), ...events];
    trim();
    log.server.info("Activity loaded", { events: events.length });
  } catch (err) {
    log.store.warn("Activity load failed", { error: String(err) });
  }
}

/** Events since a time, oldest first */
export function activitySince(since: number): ActivityEvent[] {
  trim();
  return events.filter((e) => e.t >= since);
}
