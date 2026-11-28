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
import { ideaVotes, IdeaId } from "./ideas.js";

interface RoomNow {
  id: string;
  isDev: boolean;
  people: { v: string; name: string; you: boolean; bot: boolean; unconfirmed: boolean }[];
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
  /** Focus sessions they were in the room for, start to end */
  focusDone: number;
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
  /** Visitors left out because nothing showed they're a person (see confirmedPeople), by where they came from */
  unconfirmed: { people: number; sources: { source: string; people: number }[] };
  /** "Most wanted features" votes, all time */
  ideas: Record<IdeaId, number>;
  /** Room tips over the last 7 days: times shown, "Show me" clicks, people who turned tips off */
  tips: { id: string; shown: number; clicked: number }[];
  tipsOff: number;
  /** People who opened the Features panel in the last 7 days */
  whatsNewOpens: number;
  journeys: Journeys;
}

/** How people move through Pikoo over the last 7 days (people only, not you) */
interface Journeys {
  /** How many people got to each step (each is a share of everyone, not of the step before) */
  funnel: { step: string; people: number }[];
  /** The first three pages people saw, most common first ("/ → /r/… → /") */
  firstSteps: { path: string; people: number }[];
  /** Buttons and panels (click events), by how many people used them */
  clicks: { what: string; times: number; people: number }[];
  /** What the timer was doing when people left a room */
  leaves: { midFocus: number; onBreak: number; paused: number };
  errors: { what: string; times: number; people: number }[];
  reconnects: { times: number; people: number };
  /** Opening a room until its timer showed up, in ms */
  roomLoad: { median: number; p90: number; n: number } | null;
  /** Share of time on room pages with Pikoo in a background tab (pages closed on a computer) */
  background: { share: number; pages: number } | null;
  notify: Record<string, number>;
  /** Typed room names (pikoo…/<name>), /r/ links with no room and missing pages, and what happened next */
  links: { link: string; kind: "name" | "room" | "page"; people: number; times: number; outcome: "found" | "created" | "nothing" | "offline" }[];
}

const JOIN_RE = /joined (?:silent )?room (\S+)/;
const TIP_RE = /^💡 tip (.*)$/;
// The stay ends before " · " (what the timer was doing, added 2026-11-28)
const LEAVE_RE = /left (?:silent )?room (\S+) after (.+?)(?: · .*)?$/;

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
// Is this visitor a person? Link checkers (Facebook opens every shared link in a
// few browsers for a few seconds) run our page like anyone else, often with an
// up-to-date user agent. What they don't do is touch anything or stay. So once the
// "✋ interacted" event exists, a visitor first seen after it started counts only if
// they tapped, clicked, typed or scrolled, or stayed 2 minutes or more in a room or
// on a page. Visitors first seen before that keep the old rule (bot user agents are
// left out when the line is logged).
const PERSON_STAY_SEC = 120;
export function confirmedPeople(events: ActivityEvent[]): (v: string) => boolean {
  const since = events.find((e) => e.msg.startsWith("✋ interacted"))?.t;
  if (since === undefined) return () => true;
  const firstSeen = new Map<string, number>();
  const confirmed = new Set<string>();
  for (const e of events) {
    if (!firstSeen.has(e.v)) firstSeen.set(e.v, e.t);
    const m = e.msg;
    if (m.startsWith("✋ interacted")) confirmed.add(e.v);
    const leave = m.match(LEAVE_RE);
    if (leave && staySec(leave[2]) >= PERSON_STAY_SEC) confirmed.add(e.v);
    if (m.startsWith("👋 left path=") && parseInt(prop(m, "seen") ?? "0", 10) >= PERSON_STAY_SEC) confirmed.add(e.v);
  }
  return (v) => confirmed.has(v) || (firstSeen.get(v) ?? Infinity) < since;
}

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

  // Every visit except the developer's, and which visitors are confirmed people
  const all = activitySince(now - ACTIVITY_KEEP_MS).filter((e) => !mine.has(e.v));
  const isPerson = confirmedPeople(all);

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
      people.push({ v, name: p.name, you: mine.has(v), bot: isCrawler(p.uniqueId), unconfirmed: !mine.has(v) && !isPerson(v) });
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
  const events = all.filter((e) => isPerson(e.v));
  const unconfirmedSource = new Map<string, string>();
  for (const e of all) {
    if (isPerson(e.v)) continue;
    const had = unconfirmedSource.get(e.v);
    if (had && had !== "direct") continue;
    const utm = prop(e.msg, "utm");
    const from = prop(e.msg, "from");
    unconfirmedSource.set(e.v, utm ?? (from && from !== "direct" ? site(from) : had ?? "direct"));
  }
  const unconfirmedBySource = new Map<string, number>();
  for (const src of unconfirmedSource.values()) unconfirmedBySource.set(src, (unconfirmedBySource.get(src) ?? 0) + 1);
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
      s = { v: e.v, first: e.t, last: e.t, isNew: false, source: "direct", pages: 0, rooms: [], created: 0, roomSec: 0, longestSec: 0, messages: 0, tasksAdded: 0, tasksDone: 0, shares: 0, focusDone: 0, lines: [] };
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
    if (m.startsWith("🍅")) s.focusDone++;
    s.lines.push({ t: e.t, msg: m });
    if (s.lines.length > 40) s.lines.shift();
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

  // Room tips and the Features panel
  const tipMap = new Map<string, { shown: number; clicked: number }>();
  const tipsOff = new Set<string>();
  const whatsNew = new Set<string>();
  for (const e of events) {
    if (e.msg.startsWith("✨ opened Features") || e.msg.startsWith("✨ opened What's new")) whatsNew.add(e.v);
    const tip = e.msg.match(TIP_RE);
    if (!tip) continue;
    const id = prop(tip[1], "id");
    const act = prop(tip[1], "act");
    if (act === "off") { tipsOff.add(e.v); continue; }
    if (!id) continue;
    const row = tipMap.get(id) ?? { shown: 0, clicked: 0 };
    if (act === "shown") row.shown++;
    if (act === "click") row.clicked++;
    tipMap.set(id, row);
  }
  const tips = [...tipMap.entries()].map(([id, r]) => ({ id, ...r })).sort((a, b) => b.clicked - a.clicked || b.shown - a.shown);

  // Newest events first, for alerts and the "just now" strip
  const latest = events.slice(-60).reverse().map((e) => ({ ...e, joined: JOIN_RE.test(e.msg) }));

  const { counts: ideas } = await ideaVotes();
  return {
    now, rooms, library, dev, visitors, days: dayRows, sources, suggestions: await cachedSuggestions(), latest,
    unconfirmed: {
      people: unconfirmedSource.size,
      sources: [...unconfirmedBySource.entries()].map(([source, n]) => ({ source, people: n })).sort((a, b) => b.people - a.people).slice(0, 6),
    },
    ideas, tips, tipsOff: tipsOff.size, whatsNewOpens: whatsNew.size,
    journeys: journeys(events, localDay),
  };
}

const ROOM_PATH = /^\/(?:r\/|work-with-dev|library\/)/;
/** Private room codes become "…" so paths can be grouped */
const normPath = (p: string) => p.replace(/^\/(r|embed)\/[^/]+/, "/$1/…");
const seconds = (s: string | undefined) => (s ? parseInt(s, 10) : NaN);

function countBy(map: Map<string, { times: number; people: Set<string> }>, key: string, v: string): void {
  const row = map.get(key) ?? { times: 0, people: new Set<string>() };
  row.times++;
  row.people.add(v);
  map.set(key, row);
}
const ranked = (map: Map<string, { times: number; people: Set<string> }>, top: number) =>
  [...map.entries()].map(([k, r]) => ({ k, times: r.times, people: r.people.size }))
    .sort((a, b) => b.people - a.people || b.times - a.times).slice(0, top);

function journeys(events: ActivityEvent[], localDay: (t: number) => string): Journeys {
  const per = new Map<string, { pages: string[]; openedRoom: boolean; joined: boolean; started: boolean; focused: boolean; days: Set<string> }>();
  const clicks = new Map<string, { times: number; people: Set<string> }>();
  const errors = new Map<string, { times: number; people: Set<string> }>();
  const leaves = { midFocus: 0, onBreak: 0, paused: 0 };
  const reconnectPeople = new Set<string>();
  let reconnects = 0;
  const loads: number[] = [];
  let seenSec = 0, stayedSec = 0, closedPages = 0;
  const notify: Record<string, number> = {};
  const links = new Map<string, { kind: "name" | "room" | "page"; people: Set<string>; times: number; found: boolean; offline: boolean; slug: string }>();
  const created = new Set<string>(); // room ids created in the window
  const link = (key: string, kind: "name" | "room" | "page", v: string, found: string | undefined, slug: string) => {
    const row = links.get(key) ?? { kind, people: new Set<string>(), times: 0, found: false, offline: false, slug };
    row.people.add(v);
    row.times++;
    if (found === "yes") row.found = true;
    if (found === "offline") row.offline = true;
    links.set(key, row);
  };

  for (const e of events) {
    const m = e.msg;
    let p = per.get(e.v);
    if (!p) per.set(e.v, (p = { pages: [], openedRoom: false, joined: false, started: false, focused: false, days: new Set() }));
    p.days.add(localDay(e.t));

    if (m.startsWith("👀 opened")) {
      const path = prop(m, "path");
      if (path) {
        if (ROOM_PATH.test(path)) p.openedRoom = true;
        const n = normPath(path);
        if (p.pages.length < 3 && p.pages[p.pages.length - 1] !== n) p.pages.push(n);
      }
    }
    if (JOIN_RE.test(m)) p.joined = true;
    if (m.startsWith("▶️ started the timer") || (m.startsWith("⏱️ solo timer") && prop(m, "action") === "start")) p.started = true;
    if (m.startsWith("🍅")) p.focused = true;
    if (m.startsWith("🖱️ clicked")) {
      const what = prop(m, "what") ?? "?";
      countBy(clicks, what === "settings_close" ? `settings_close_${prop(m, "changed") ?? "?"}` : what, e.v);
    }
    if (m.startsWith("⚠️ saw an error")) countBy(errors, `${prop(m, "where") ?? "?"}: ${m.match(/msg=(.*)$/)?.[1] ?? ""}`, e.v);
    if (m.startsWith("🔌 reconnected")) { reconnects++; reconnectPeople.add(e.v); }
    if (m.startsWith("⚡ room loaded")) {
      const ms = Number(prop(m, "ms"));
      if (Number.isFinite(ms) && ms >= 0 && ms < 120_000) loads.push(ms);
    }
    if (m.startsWith("👋 left") && ROOM_PATH.test(prop(m, "path") ?? "")) {
      const after = seconds(prop(m, "after"));
      const seen = seconds(prop(m, "seen"));
      if (after > 0 && seen >= 0 && seen <= after) { stayedSec += after; seenSec += seen; closedPages++; }
    }
    if (m.startsWith("🔔 notifications")) {
      const r = prop(m, "result") ?? "?";
      notify[r] = (notify[r] ?? 0) + 1;
    }
    if (m.startsWith("🔤 typed a room name")) {
      const name = m.match(/ name=(.*?) found=/)?.[1] ?? prop(m, "name") ?? "?";
      link(`/${name}`, "name", e.v, prop(m, "found"), toName(name));
    }
    if (m.startsWith("🚫 opened a room link with no room")) {
      const code = prop(m, "code") ?? "?";
      link(`/r/${code}`, "room", e.v, prop(m, "found"), code);
    }
    if (m.startsWith("❓ opened a page that doesn't exist")) link(prop(m, "path") ?? "?", "page", e.v, undefined, "");
    const made = m.match(/^🏠 created room (\S+)/);
    if (made) created.add(made[1]);
    if (m.startsWith("🚪 left room")) {
      if (m.includes(" · mid-focus")) leaves.midFocus++;
      else if (m.includes(" · on a break")) leaves.onBreak++;
      else if (m.includes(" · timer paused")) leaves.paused++;
    }
  }

  const people = [...per.values()];
  const count = (f: (p: (typeof people)[number]) => boolean) => people.filter(f).length;
  const firstSteps = new Map<string, number>();
  for (const p of people) if (p.pages.length) firstSteps.set(p.pages.join(" → "), (firstSteps.get(p.pages.join(" → ")) ?? 0) + 1);
  loads.sort((a, b) => a - b);

  return {
    funnel: [
      { step: "Visited Pikoo", people: people.length },
      { step: "Opened a room", people: count((p) => p.openedRoom || p.joined) },
      { step: "Joined a room", people: count((p) => p.joined) },
      { step: "Started a timer", people: count((p) => p.started) },
      { step: "Finished a focus session", people: count((p) => p.focused) },
      { step: "Came back on another day", people: count((p) => p.days.size > 1) },
    ],
    firstSteps: [...firstSteps.entries()].map(([path, n]) => ({ path, people: n })).sort((a, b) => b.people - a.people).slice(0, 8),
    clicks: ranked(clicks, 20).map(({ k, ...r }) => ({ what: k, ...r })),
    leaves,
    errors: ranked(errors, 8).map(({ k, ...r }) => ({ what: k, ...r })),
    reconnects: { times: reconnects, people: reconnectPeople.size },
    roomLoad: loads.length ? { median: loads[Math.floor(loads.length / 2)], p90: loads[Math.min(loads.length - 1, Math.floor(loads.length * 0.9))], n: loads.length } : null,
    background: stayedSec > 0 ? { share: Math.round((1 - seenSec / stayedSec) * 100) / 100, pages: closedPages } : null,
    notify,
    links: [...links.entries()]
      .map(([k, r]) => ({
        link: k, kind: r.kind, people: r.people.size, times: r.times,
        outcome: r.found ? "found" as const : r.slug && created.has(r.slug) ? "created" as const : r.offline ? "offline" as const : "nothing" as const,
      }))
      .sort((a, b) => b.people - a.people || b.times - a.times)
      .slice(0, 20),
  };
}

/** Same as the frontend's toRoomName: "Night Owls" → "night-owls" */
const toName = (raw: string) =>
  raw.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 32);
