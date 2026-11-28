// ============================================
// Anonymous daily usage counters
// ============================================
// Counts events per UTC day (no names, no IPs, no message text). Unique users are
// counted with a HyperLogLog of the random per-browser uniqueId, so individual
// ids can't be read back. Kept for 90 days in Redis, in memory otherwise.

import { createHash } from "node:crypto";
import { getRedis } from "./store.js";
import { log } from "./logger.js";
import { recordActivity } from "./activity.js";

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
  if (uniqueId && crawlerIds.has(uniqueId)) return;
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
export const visitorId = (uniqueId: string | undefined): string =>
  uniqueId ? "v" + createHash("sha256").update(uniqueId).digest("hex").slice(0, 6) : "v??????";

export function visitorTag(uniqueId: string | undefined, name?: string): string {
  return `[${visitorId(uniqueId)}${name && name !== "Anonymous" ? ` ${name}` : ""}]`;
}

// Search engines and link-preview bots run our JS and fire trace events too.
// They go to a separate "crawlers" log so "visitors" only shows people.
const CRAWLER_RE = /(googlebot|google-inspectiontool|googleother|adsbot|mediapartners|bingbot|bingpreview|adidxbot|msnbot|yandex|baiduspider|duckduckbot|applebot|slurp|petalbot|bytespider|gptbot|claudebot|perplexitybot|ahrefsbot|semrushbot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|headlesschrome|lighthouse|chrome-lighthouse|crawler|spider|\bbot\b)/i;

// Some bots pass as an ordinary desktop Chrome but months out of date (one opens
// a random page every ~50 minutes from a new cloud IP each time). Real Chrome
// updates itself every 4 weeks. Only the plain Chrome string is checked, so Edge,
// Opera, Samsung Internet, phones and Chromebooks, which can lag, never match.
const DESKTOP_CHROME_RE = /^Mozilla\/5\.0 \((?:Windows NT [\d.]+; Win64; x64|Macintosh; Intel Mac OS X [\d_]+|X11; Linux x86_64)\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/(\d+)\.[\d.]+ Safari\/537\.36$/;
const STALE_CHROME_VERSIONS = 6;
// Chrome 131 shipped on 2024-11-12 and a new major version comes about every 4 weeks
export const currentChromeVersion = (now = Date.now()) => 131 + Math.floor((now - Date.UTC(2024, 10, 12)) / (28 * 86_400_000));

export function crawlerName(ua: string | undefined, now = Date.now()): string | null {
  if (!ua) return "no-user-agent";
  const m = ua.match(CRAWLER_RE);
  if (m) return m[1];
  const chrome = ua.match(DESKTOP_CHROME_RE);
  if (chrome && Number(chrome[1]) < currentChromeVersion(now) - STALE_CHROME_VERSIONS) return `old-chrome-${chrome[1]}`;
  return null;
}

// Browser ids seen with a bot user agent. Their room joins, leaves and reactions
// (which come over the socket) are logged as crawlers too, and not counted in stats.
const crawlerIds = new Map<string, string>();

export function markCrawler(uniqueId: string | undefined, ua: string | undefined): void {
  const bot = crawlerName(ua);
  if (!uniqueId || !bot) return;
  if (crawlerIds.size > 5000) crawlerIds.clear();
  crawlerIds.set(uniqueId, bot);
}

export const isCrawler = (uniqueId: string | undefined): boolean => !!uniqueId && crawlerIds.has(uniqueId);

/** A browser that reports it's driven by automation (navigator.webdriver): a bot, whatever its user agent */
export function markAutomated(uniqueId: string | undefined): void {
  if (!uniqueId) return;
  if (crawlerIds.size > 5000) crawlerIds.clear();
  crawlerIds.set(uniqueId, "automated");
}

export function logVisitor(uniqueId: string | undefined, msg: string, name?: string): void {
  const bot = uniqueId ? crawlerIds.get(uniqueId) : undefined;
  if (bot) log.crawlers.info(`🤖 ${bot} ${visitorTag(uniqueId, name)} ${msg}`);
  else {
    log.visitors.info(`${visitorTag(uniqueId, name)} ${msg}`);
    recordActivity(visitorId(uniqueId), name, msg);
  }
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
