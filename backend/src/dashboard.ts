// ============================================
// The developer's private dashboard (GET /dashboard, frontend /dashboard)
// ============================================
// Who is in which room right now, per-visitor summaries of the last 7 days
// (from the activity store, people only), daily numbers and suggestions.
// Only the developer's browser can read it (see devRoom.ts).

import { Server } from "socket.io";
import { getRoom, getSuggestions, Suggestion } from "./store.js";
import { activitySince, ActivityEvent, ACTIVITY_KEEP_MS } from "./activity.js";
import { visitorId, isCrawler } from "./stats.js";
import { LIBRARY_ROOMS, libraryCount } from "./library.js";
import { DEV_ROOM_ID, devRoomStatus, DevRoomStatus } from "./devRoom.js";

interface RoomNow {
  id: string;
  isDev: boolean;
  people: { v: string; name: string; you: boolean; bot: boolean }[];
  viewers: number; // stream overlays / embeds
  phase: string;
  running: boolean;
  phaseEndsAt: number | null;
  remainingSecWhenPaused: number;
  focusMin: number;
  breakMin: number;
}

interface VisitorSummary {
  v: string;
  name?: string;
  first: number;
  last: number;
  isNew: boolean;
  device?: string;
  source: string;
  landing?: string;
  pages: number;
  rooms: string[];
  created: number;
  roomSec: number;
  longestSec: number;
  messages: number;
  tasksAdded: number;
  tasksDone: number;
  shares: number;
  inRoomNow?: string;
  lines: { t: number; msg: string }[];
}

interface DayRow {
  day: string;          // viewer's local date, YYYY-MM-DD
  visitors: number;
  joined: number;       // visitors who joined any room
  roomHours: number;    // time people spent in rooms (stays ending that day)
  roomsCreated: number;
}

export interface DashboardData {
  now: number;
  rooms: RoomNow[];
  library: { id: string; name: string; count: number }[];
  dev: DevRoomStatus;
  visitors: VisitorSummary[];
  days: DayRow[];
  sources: { source: string; visitors: number; joined: number }[];
  suggestions: Suggestion[];
  latest: (ActivityEvent & { joined: boolean })[];
}

const JOIN_RE = /joined (?:silent )?room (\S+)/;
const LEAVE_RE = /left (?:silent )?room (\S+) after (.+)$/;

/** "1h 2m", "15m 58s", "4s" → seconds */
function staySec(s: string): number {
  let sec = 0;
  for (const [, n, unit] of s.matchAll(/(\d+)([hms])/g)) sec += Number(n) * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
  return sec;
}

const prop = (msg: string, key: string) => msg.match(new RegExp(`(?:^| )${key}=(\\S+)`))?.[1];

/** "www.reddit.com" → "reddit.com", "l.instagram.com" → "instagram.com" */
const site = (host: string) => host.replace(/^(?:www|l|lm|m|out)\./, "");

let suggestionCache: { at: number; list: Suggestion[] } | null = null;
/** Called when a suggestion is saved, so the next refresh shows it */
export const forgetSuggestionCache = () => { suggestionCache = null; };
async function cachedSuggestions(): Promise<Suggestion[]> {
  if (!suggestionCache || Date.now() - suggestionCache.at > 20_000) {
    suggestionCache = { at: Date.now(), list: (await getSuggestions()).slice(0, 200) };
  }
  return suggestionCache.list;
}

export async function dashboardData(io: Server, viewerUid: string | undefined, tzOffsetMin: number): Promise<DashboardData> {
  const now = Date.now();
  const dev = await devRoomStatus();
  const devRoom = await getRoom(DEV_ROOM_ID);

  // The developer's own browser is left out of the feed and the numbers
  const mine = new Set<string>();
  if (viewerUid) mine.add(visitorId(viewerUid));
  if (devRoom?.hostId) mine.add(visitorId(devRoom.hostId));

  // ---- Rooms with anyone in them right now
  const adapter = io.of("/").adapter;
  const rooms: RoomNow[] = [];
  for (const [name, sids] of adapter.rooms) {
    if (adapter.sids.has(name) || name.startsWith("library:")) continue; // a socket's own room, a silent-room channel
    const room = await getRoom(name);
    if (!room) continue;
    const seen = new Set<string>();
    const people: RoomNow["people"] = [];
    for (const p of room.participants) {
      if (seen.has(p.uniqueId)) continue;
      seen.add(p.uniqueId);
      const v = visitorId(p.uniqueId);
      people.push({ v, name: p.name, you: mine.has(v), bot: isCrawler(p.uniqueId) });
    }
    let viewers = 0;
    for (const id of sids) if (io.sockets.sockets.get(id)?.data.spectator) viewers++;
    if (!people.length && !viewers) continue;
    rooms.push({
      id: room.id,
      isDev: room.id === DEV_ROOM_ID,
      people,
      viewers,
      phase: room.timer.phase,
      running: room.timer.running,
      phaseEndsAt: room.timer.phaseEndsAt,
      remainingSecWhenPaused: room.timer.remainingSecWhenPaused,
      focusMin: Math.round(room.settings.focusSec / 60),
      breakMin: Math.round(room.settings.breakSec / 60),
    });
  }
  rooms.sort((a, b) => b.people.length - a.people.length);
  const roomOf = new Map<string, string>();
  for (const r of rooms) for (const p of r.people) roomOf.set(p.v, r.id);

  const library = await Promise.all(LIBRARY_ROOMS.map(async (r) => ({ id: r.id, name: r.name, count: await libraryCount(io, r.id) })));
  // People in silent rooms are sockets on the room's channel
  for (const s of io.sockets.sockets.values()) {
    const lib = s.data.libraryRoom as string | undefined;
    if (lib && s.data.uniqueId && s.rooms.has(`library:${lib}`)) roomOf.set(visitorId(s.data.uniqueId), `silent room ${lib}`);
  }

  // ---- Visitors over the last 7 days
  const events = activitySince(now - ACTIVITY_KEEP_MS).filter((e) => !mine.has(e.v));
  const byVisitor = new Map<string, VisitorSummary>();
  const localDay = (t: number) => new Date(t - tzOffsetMin * 60_000).toISOString().slice(0, 10);
  const days = new Map<string, { visitors: Set<string>; joined: Set<string>; roomSec: number; roomsCreated: number }>();
  const dayRow = (t: number) => {
    const d = localDay(t);
    let row = days.get(d);
    if (!row) days.set(d, (row = { visitors: new Set(), joined: new Set(), roomSec: 0, roomsCreated: 0 }));
    return row;
  };

  for (const e of events) {
    let s = byVisitor.get(e.v);
    if (!s) {
      s = { v: e.v, first: e.t, last: e.t, isNew: false, source: "direct", pages: 0, rooms: [], created: 0, roomSec: 0, longestSec: 0, messages: 0, tasksAdded: 0, tasksDone: 0, shares: 0, lines: [] };
      byVisitor.set(e.v, s);
    }
    s.last = e.t;
    if (e.name) s.name = e.name;
    const day = dayRow(e.t);
    day.visitors.add(e.v);
    const m = e.msg;

    if (m.startsWith("👀 opened")) {
      s.pages++;
      if (s.pages === 1) {
        s.landing = prop(m, "path");
        s.device = prop(m, "device");
      }
      const utm = prop(m, "utm");
      const from = prop(m, "from");
      if (s.source === "direct" && (utm || (from && from !== "direct"))) s.source = utm ?? site(from!);
    }
    const join = m.match(JOIN_RE);
    if (join) {
      if (!s.rooms.includes(join[1])) s.rooms.push(join[1]);
      if (m.includes("NEW person")) s.isNew = true;
      day.joined.add(e.v);
    }
    const leave = m.match(LEAVE_RE);
    if (leave) {
      const sec = staySec(leave[2]);
      s.roomSec += sec;
      s.longestSec = Math.max(s.longestSec, sec);
      day.roomSec += sec;
    }
    if (m.startsWith("🏠 created room")) { s.created++; day.roomsCreated++; }
    if (m.startsWith("💬")) s.messages++;
    if (m.startsWith("📝 added a task")) s.tasksAdded++;
    if (m.startsWith("✅")) s.tasksDone++;
    if (m.startsWith("📤")) s.shares++;
    s.lines.push({ t: e.t, msg: m });
    if (s.lines.length > 25) s.lines.shift();
  }

  for (const s of byVisitor.values()) s.inRoomNow = roomOf.get(s.v);
  const visitors = [...byVisitor.values()].sort((a, b) => b.last - a.last).slice(0, 120);

  const dayRows: DayRow[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = localDay(now - i * 86_400_000);
    const row = days.get(d);
    dayRows.push({
      day: d,
      visitors: row?.visitors.size ?? 0,
      joined: row?.joined.size ?? 0,
      roomHours: Math.round(((row?.roomSec ?? 0) / 3600) * 10) / 10,
      roomsCreated: row?.roomsCreated ?? 0,
    });
  }

  const sourceMap = new Map<string, { visitors: number; joined: number }>();
  for (const s of byVisitor.values()) {
    const row = sourceMap.get(s.source) ?? { visitors: 0, joined: 0 };
    row.visitors++;
    if (s.rooms.length) row.joined++;
    sourceMap.set(s.source, row);
  }
  const sources = [...sourceMap.entries()].map(([source, r]) => ({ source, ...r })).sort((a, b) => b.visitors - a.visitors);

  // Newest events first, for alerts and the "just now" strip
  const latest = events.slice(-60).reverse().map((e) => ({ ...e, joined: JOIN_RE.test(e.msg) }));

  return { now, rooms, library, dev, visitors, days: dayRows, sources, suggestions: await cachedSuggestions(), latest };
}
