"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { isDevBrowser } from "@/components/DevRoomBits";
import { getUserId, getUserSecret } from "@/components/NamePrompt";
import { DEV_PATH, sinceLabel } from "@/lib/devRoom";
import { IDEAS } from "@/lib/whatsNew";
import { getNotificationPermission, notifyActivity, requestNotificationPermission } from "@/lib/audio";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const POLL_MS = 10_000;
const ALERTS_KEY = "pikoo:dashboard-alerts";

// Shapes returned by GET /dashboard (backend/src/dashboard.ts)
interface RoomNow {
  id: string;
  isDev: boolean;
  people: { v: string; name: string; you: boolean; bot: boolean }[];
  viewers: number;
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
  focusDone?: number;
  inRoomNow?: string;
  lines: { t: number; msg: string }[];
}
interface DayRow { day: string; visitors: number; joined: number; roomHours: number; roomsCreated: number }
interface Suggestion { text: string; name?: string; roomId?: string; createdAt: number }
interface LatestEvent { t: number; v: string; name?: string; msg: string; joined: boolean }
interface DashboardData {
  now: number;
  rooms: RoomNow[];
  library: { id: string; name: string; count: number }[];
  dev: { live: boolean; since: number | null; people: number };
  visitors: VisitorSummary[];
  days: DayRow[];
  sources: { source: string; visitors: number; joined: number }[];
  suggestions: Suggestion[];
  latest: LatestEvent[];
  ideas: Record<string, number>;
  tips: { id: string; shown: number; clicked: number }[];
  tipsOff: number;
  whatsNewOpens: number;
  journeys?: Journeys;
}
interface Journeys {
  funnel: { step: string; people: number }[];
  firstSteps: { path: string; people: number }[];
  clicks: { what: string; times: number; people: number }[];
  leaves: { midFocus: number; onBreak: number; paused: number };
  errors: { what: string; times: number; people: number }[];
  reconnects: { times: number; people: number };
  roomLoad: { median: number; p90: number; n: number } | null;
  background: { share: number; pages: number } | null;
  notify: Record<string, number>;
}

const TIP_LABELS: Record<string, string> = {
  autostart: "Auto-start", space: "Space to start/pause", addtime: "+5 min", schedule: "Schedule a session",
  leaderboard: "Leaderboard", privacy: "Private tasks", music: "Music", theme: "Background",
  notify: "Notifications", embed: "Notion / stream timer", silent: "Silent rooms",
};

// Click events (what=…) in plain words; anything new shows its raw name
const CLICK_LABELS: Record<string, string> = {
  settings_open: "Opened timer settings",
  settings_close_no: "Closed timer settings without a change",
  settings_close_yes: "Closed timer settings after a change",
  chat_open: "Opened chat",
  more_menu: "Opened the ⋯ menu",
  leaderboard: "Opened the leaderboard (menu)",
  schedule: "Opened the schedule",
  feedback_button: "Opened Feedback",
  background_button: "Opened backgrounds",
  music_button: "Opened music",
  share_menu: "Opened Share",
  tasks_panel: "Opened tasks (phone)",
  invite_nudge_dismiss: "Closed the invite nudge",
  summary_dismiss: "Closed the Session done card",
  session_prompt_skip: "Skipped picking a task",
  whats_new_idea: "Share an idea (What's new)",
  whats_new_try: "Try it (What's new)",
  dev_live_badge: "Clicked the dev room live badge",
  empty_invite: "Invite from an empty silent room",
  empty_dev_room: "Dev room from an empty silent room",
  empty_solo_timer: "Solo timer from an empty silent room",
};

// ---- formatting
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
function ago(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}
function when(t: number, now: number): string {
  const today = new Date(now).toDateString() === new Date(t).toDateString();
  return today ? clock(t) : `${new Date(t).toLocaleDateString([], { weekday: "short" })} ${clock(t)}`;
}
function duration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: "short" });
const roomHref = (id: string, isDev = false) => (isDev ? DEV_PATH : `/r/${id}`);
const who = (x: { name?: string; v: string }) => x.name ?? x.v;

export function DashboardView() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [alertsOn, setAlertsOn] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(ALERTS_KEY) === "1"; } catch { return false; }
  });
  const alertsRef = useRef(alertsOn);
  const seen = useRef<{ eventT: number; suggestionT: number } | null>(null);

  useEffect(() => {
    void isDevBrowser().then(setAllowed);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/dashboard?tz=${new Date().getTimezoneOffset()}`, {
        headers: { "x-pikoo-secret": getUserSecret(), "x-pikoo-uid": getUserId() },
        cache: "no-store",
      });
      if (res.status === 404) { setAllowed(false); return; }
      if (!res.ok) { setFailed(true); return; }
      const d = (await res.json()) as DashboardData;
      setFailed(false);

      // Alerts for what's new since the last poll (nothing on the first load)
      const newestEvent = d.latest[0]?.t ?? 0;
      const newestSuggestion = d.suggestions[0]?.createdAt ?? 0;
      if (seen.current && alertsRef.current) {
        const joins = d.latest.filter((e) => e.t > seen.current!.eventT && e.joined).slice(0, 3);
        for (const e of joins) void notifyActivity(`${who(e)} joined a room`, e.msg.replace(/^\S+\s/, ""), `pikoo-dash-${e.v}-${e.t}`);
        const fresh = d.suggestions.filter((s) => s.createdAt > seen.current!.suggestionT).slice(0, 3);
        for (const s of fresh) void notifyActivity("New suggestion", s.text.slice(0, 140), `pikoo-dash-s-${s.createdAt}`);
      }
      seen.current = {
        eventT: Math.max(seen.current?.eventT ?? 0, newestEvent),
        suggestionT: Math.max(seen.current?.suggestionT ?? 0, newestSuggestion),
      };
      setData(d);
      setNow(Date.now());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => { clearTimeout(first); clearInterval(id); clearInterval(tick); };
  }, [allowed, load]);

  // Tab title shows how many people are in rooms (you excluded)
  const peopleNow = data ? data.rooms.reduce((n, r) => n + r.people.filter((p) => !p.you && !p.bot).length, 0) + data.library.reduce((n, l) => n + l.count, 0) : 0;
  useEffect(() => {
    if (data) document.title = `${peopleNow ? `(${peopleNow}) ` : ""}Dashboard · Pikoo`;
  }, [data, peopleNow]);

  const toggleAlerts = async () => {
    const next = !alertsOn;
    if (next && getNotificationPermission() === "default") await requestNotificationPermission();
    if (next) void notifyActivity("Alerts are on", "You'll hear this when someone joins a room or sends a suggestion.", "pikoo-dash-test");
    setAlertsOn(next);
    alertsRef.current = next;
    try { localStorage.setItem(ALERTS_KEY, next ? "1" : "0"); } catch { /* storage blocked */ }
  };

  if (allowed === false) {
    return <div className="min-h-screen bg-black text-white/50 flex items-center justify-center text-sm">Not available.</div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white/50 flex items-center justify-center text-sm">
        {failed ? "Couldn't reach the server. Retrying…" : "Loading…"}
      </div>
    );
  }

  const today = data.days[data.days.length - 1];
  const activeLibrary = data.library.filter((l) => l.count > 0);
  const permission = getNotificationPermission();

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold tracking-tight">Pikoo</Link>
            <span className="text-white/40">Dashboard</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/45">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${failed ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
              {failed ? "Reconnecting…" : `Updated ${ago(data.now, now)}`}
            </span>
            <button
              onClick={toggleAlerts}
              className={`h-8 px-3 rounded-full border text-xs ${alertsOn ? "border-rose-400/40 bg-rose-500/15 text-rose-100" : "border-white/15 text-white/70 hover:bg-white/5"}`}
              title="A sound and a notification when someone joins a room or sends a suggestion (while this tab is open)"
            >
              {alertsOn ? "🔔 Alerts on" : "🔕 Alerts off"}
            </button>
          </div>
        </div>
        {alertsOn && permission === "denied" && (
          <p className="max-w-6xl mx-auto px-4 sm:px-6 pb-2 text-xs text-amber-300/80">Notifications are blocked for this site in Chrome; you&apos;ll only hear the sound.</p>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Today */}
        <section aria-label="Today" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Tile label="In rooms now" value={peopleNow} accent={peopleNow > 0} />
          <Tile label="Visitors today" value={today.visitors} />
          <Tile label="Joined a room" value={today.joined} />
          <Tile label="Hours in rooms" value={today.roomHours} />
          <Tile label="Rooms created" value={today.roomsCreated} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Right now */}
          <Card title="Right now">
            <DevLine dev={data.dev} now={now} />
            {data.rooms.length === 0 && activeLibrary.length === 0 ? (
              <p className="text-sm text-white/40">Nobody is in a room.</p>
            ) : (
              <ul className="space-y-2">
                {data.rooms.map((r) => (
                  <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={roomHref(r.id, r.isDev)} target="_blank" className="text-sm font-medium hover:underline truncate">
                        {r.isDev ? "Your dev room" : r.id}
                      </Link>
                      <span className="shrink-0 text-xs text-white/45 tabular-nums">
                        {r.phase === "focus" ? "Focus" : "Break"} · {r.running && r.phaseEndsAt ? `${Math.max(0, Math.ceil((r.phaseEndsAt - now) / 60_000))} min left` : "paused"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/60">
                      {r.people.map((p, i) => (
                        <span key={p.v}>
                          {i > 0 && ", "}
                          {p.name}
                          {p.you && <span className="text-white/35"> (you)</span>}
                          {p.bot && <span className="text-white/35"> (bot)</span>}
                        </span>
                      ))}
                      {r.viewers > 0 && <span className="text-white/35"> · {r.viewers} overlay{r.viewers > 1 ? "s" : ""}</span>}
                    </p>
                  </li>
                ))}
                {activeLibrary.map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] px-3 py-2.5 text-sm">
                    <Link href={`/library/${l.id}`} target="_blank" className="hover:underline">{l.name}</Link>
                    <span className="text-xs text-white/55">{l.count} in the silent room</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Last 7 days */}
          <Card title="Last 7 days">
            <WeekChart days={data.days} />
            <table className="mt-5 w-full text-xs">
              <thead>
                <tr className="text-white/40 text-left">
                  <th className="font-normal pb-1.5">Came from</th>
                  <th className="font-normal pb-1.5 text-right">Visitors</th>
                  <th className="font-normal pb-1.5 text-right">Joined a room</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.sources.length === 0 && <tr><td className="py-1 text-white/40" colSpan={3}>No visitors yet.</td></tr>}
                {data.sources.map((s) => (
                  <tr key={s.source} className="border-t border-white/5">
                    <td className="py-1.5 text-white/75">{s.source}</td>
                    <td className="py-1.5 text-right text-white/75">{s.visitors}</td>
                    <td className="py-1.5 text-right text-white/75">{s.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Suggestions */}
        <Card title={`Suggestions${data.suggestions.length ? ` (${data.suggestions.length})` : ""}`}>
          {data.suggestions.length === 0 ? (
            <p className="text-sm text-white/40">None yet. They show up here the moment someone sends one.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.suggestions.map((s) => (
                <li key={s.createdAt + s.text.slice(0, 20)} className="py-2.5">
                  <p className="text-sm text-white/85 whitespace-pre-wrap break-words">{s.text}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {s.name ? `${s.name} · ` : ""}{s.roomId ? `room ${s.roomId} · ` : ""}{when(s.createdAt, now)} ({ago(s.createdAt, now)})
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* What's new votes */}
          <Card title="Most wanted features" note={`Votes from the What's new panel, all time. Opened by ${data.whatsNewOpens ?? 0} ${(data.whatsNewOpens ?? 0) === 1 ? "person" : "people"} in the last 7 days.`}>
            <IdeaVotes ideas={data.ideas ?? {}} />
          </Card>

          {/* Room tips */}
          <Card title="Room tips, last 7 days" note={`How often each tip was shown and how often "Show me" was clicked. ${data.tipsOff ?? 0} turned tips off.`}>
            {!data.tips?.length ? (
              <p className="text-sm text-white/40">No tips shown yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-left">
                    <th className="font-normal pb-1.5">Tip</th>
                    <th className="font-normal pb-1.5 text-right">Shown</th>
                    <th className="font-normal pb-1.5 text-right">Clicked</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.tips.map((t) => (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="py-1.5 text-white/75">{TIP_LABELS[t.id] ?? t.id}</td>
                      <td className="py-1.5 text-right text-white/75">{t.shown}</td>
                      <td className="py-1.5 text-right text-white/75">
                        {t.clicked}
                        {t.shown > 0 && <span className="ml-1.5 text-white/35">{Math.round((t.clicked / t.shown) * 100)}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {data.journeys && <JourneyCards j={data.journeys} />}

        {/* Visitors */}
        <Card title="Visitors, last 7 days" note="Newest first. Bots and your own visits are left out.">
          {data.visitors.length === 0 ? (
            <p className="text-sm text-white/40">No visitors yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.visitors.map((s) => <VisitorRow key={s.v} s={s} now={now} />)}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const secsLabel = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

function JourneyCards({ j }: { j: Journeys }) {
  const visitors = j.funnel[0]?.people ?? 0;
  const left = j.leaves.midFocus + j.leaves.onBreak + j.leaves.paused;
  const notify = Object.entries(j.notify);
  return (
    <>
      <Card title="Journeys, last 7 days" note="People only, not you. Each step is a share of everyone who visited. Finished focus sessions and the stats on the right are counted from Nov 28.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <ul className="space-y-2.5">
              {j.funnel.map((f) => (
                <li key={f.step} className="text-xs" title={`${f.step}: ${f.people} of ${visitors} (${pct(f.people, visitors)}%)`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-white/75">{f.step}</span>
                    <span className="shrink-0 tabular-nums text-white/85">{f.people}<span className="ml-1.5 text-white/35">{pct(f.people, visitors)}%</span></span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/5">
                    {f.people > 0 && <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct(f.people, visitors)}%` }} />}
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="mt-5 text-xs font-medium text-white/60">First pages people see</h3>
            {j.firstSteps.length === 0 ? <p className="mt-1 text-xs text-white/40">Nothing yet.</p> : (
              <ul className="mt-1.5 space-y-1 text-xs">
                {j.firstSteps.map((s) => (
                  <li key={s.path} className="flex justify-between gap-3">
                    <span className="font-mono text-white/70 break-all">{s.path}</span>
                    <span className="shrink-0 tabular-nums text-white/85">{s.people}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 content-start text-xs">
            <Stat label="Left a room mid-focus" value={left ? `${j.leaves.midFocus} of ${left}` : "–"} note={left ? `${j.leaves.onBreak} on a break, ${j.leaves.paused} while paused` : "No room leaves yet"} />
            <Stat label="Pikoo in a background tab" value={j.background ? `${Math.round(j.background.share * 100)}%` : "–"} note={j.background ? `of time on room pages, from ${j.background.pages} closed on a computer` : "Needs a few closed room pages"} />
            <Stat label="Room load time" value={j.roomLoad ? secsLabel(j.roomLoad.median) : "–"} note={j.roomLoad ? `median of ${j.roomLoad.n}; slowest 10% over ${secsLabel(j.roomLoad.p90)}` : "No rooms opened yet"} />
            <Stat label="Lost connection (5 s+)" value={String(j.reconnects.times)} note={`${j.reconnects.people} ${j.reconnects.people === 1 ? "person" : "people"}`} />
            <Stat label="Notifications asked" value={String(notify.reduce((n, [, c]) => n + c, 0))} note={notify.length ? notify.map(([r, c]) => `${c} ${r}`).join(", ") : "Nobody was asked yet"} />
          </dl>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Buttons and panels, last 7 days" note="By how many people used each one.">
          {j.clicks.length === 0 ? <p className="text-sm text-white/40">No clicks yet.</p> : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 text-left">
                  <th className="font-normal pb-1.5">Button or panel</th>
                  <th className="font-normal pb-1.5 text-right">People</th>
                  <th className="font-normal pb-1.5 text-right">Times</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {j.clicks.map((c) => (
                  <tr key={c.what} className="border-t border-white/5">
                    <td className="py-1.5 text-white/75">{CLICK_LABELS[c.what] ?? c.what}</td>
                    <td className="py-1.5 text-right text-white/75">{c.people}</td>
                    <td className="py-1.5 text-right text-white/45">{c.times}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Errors people saw, last 7 days" note="Room messages (like a full room) and JavaScript errors, the first few per page.">
          {j.errors.length === 0 ? <p className="text-sm text-white/40">None.</p> : (
            <ul className="space-y-1.5 text-xs">
              {j.errors.map((e) => (
                <li key={e.what} className="flex justify-between gap-3">
                  <span className="font-mono text-white/70 break-all">{e.what}</span>
                  <span className="shrink-0 tabular-nums text-white/85">{e.people} <span className="text-white/35">({e.times}×)</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <dt className="text-white/45">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white/90">{value}</dd>
      <dd className="text-white/40">{note}</dd>
    </div>
  );
}

function IdeaVotes({ ideas }: { ideas: Record<string, number> }) {
  const rows = IDEAS.map((i) => ({ ...i, votes: ideas[i.id] ?? 0 })).sort((a, b) => b.votes - a.votes);
  const max = Math.max(1, ...rows.map((r) => r.votes));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id} className="text-xs" title={`${r.title}: ${r.votes} ${r.votes === 1 ? "vote" : "votes"}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/75 truncate"><span aria-hidden>{r.emoji} </span>{r.title}</span>
            <span className="shrink-0 tabular-nums text-white/85">{r.votes}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/5">
            {r.votes > 0 && <div className="h-full rounded-full bg-rose-500" style={{ width: `${(r.votes / max) * 100}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-white/85">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-white/35">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tile({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${accent ? "border-rose-400/40 bg-rose-500/10" : "border-white/10 bg-white/[0.02]"}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-white/45">{label}</p>
    </div>
  );
}

function DevLine({ dev, now }: { dev: DashboardData["dev"]; now: number }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-xs text-white/55">
      <span className={`w-2 h-2 rounded-full ${dev.live ? "bg-rose-400 animate-pulse" : "bg-white/25"}`} />
      {dev.live
        ? <>Your dev room is live{dev.since ? ` for ${sinceLabel(dev.since, now)}` : ""} · {Math.max(0, dev.people - 1)} with you</>
        : <>Your dev room is offline · <Link href={DEV_PATH} target="_blank" className="underline underline-offset-2 hover:text-white">open it</Link></>}
    </p>
  );
}

// Stacked bars: visitors who joined a room (rose) under those who only looked around (blue)
const JOINED = "#f43f5e";
const LOOKED = "#3b82f6";
function WeekChart({ days }: { days: DayRow[] }) {
  const max = Math.max(1, ...days.map((d) => d.visitors));
  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-white/55">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: JOINED }} />Joined a room</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: LOOKED }} />Only visited</span>
      </div>
      <div className="mt-3 flex items-end gap-2 h-36 border-b border-white/10" role="img" aria-label="Visitors per day over the last 7 days">
        {days.map((d) => {
          const looked = d.visitors - d.joined;
          return (
            <div key={d.day} className="group relative flex-1 h-full flex flex-col justify-end items-center">
              <span className="mb-1 text-[11px] tabular-nums text-white/70">{d.visitors || ""}</span>
              <div className="w-full max-w-10 flex flex-col gap-[2px]" style={{ height: `${(d.visitors / max) * 100}%` }}>
                {looked > 0 && <div className="w-full rounded-t-[4px]" style={{ flex: looked, background: LOOKED }} />}
                {d.joined > 0 && <div className={`w-full ${looked > 0 ? "" : "rounded-t-[4px]"}`} style={{ flex: d.joined, background: JOINED }} />}
              </div>
              {/* Hover: the day's numbers */}
              <div className="pointer-events-none absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap rounded-lg border border-white/10 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white/80 shadow-xl z-10">
                <p className="font-medium text-white">{weekday(d.day)} {d.day.slice(5)}</p>
                <p>{d.visitors} visitors · {d.joined} joined a room</p>
                <p>{d.roomHours} h in rooms · {d.roomsCreated} rooms made</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2 text-[11px] text-white/40">
        {days.map((d) => (
          <div key={d.day} className="flex-1 text-center">
            {weekday(d.day)}
            <span className="block text-white/30 tabular-nums">{d.roomHours ? `${d.roomHours}h` : "–"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisitorRow({ s, now }: { s: VisitorSummary; now: number }) {
  const facts = [
    s.isNew ? "new" : null,
    s.device,
    s.source !== "direct" ? `from ${s.source}` : "direct",
    s.landing ? `landed on ${s.landing}` : null,
  ].filter(Boolean);
  const did = [
    s.created ? `made ${s.created === 1 ? "a room" : `${s.created} rooms`}` : null,
    s.rooms.length ? `joined ${s.rooms.length === 1 ? "a room" : `${s.rooms.length} rooms`}` : null,
    s.roomSec ? `${duration(s.roomSec)} in rooms${s.longestSec >= 600 && s.longestSec < s.roomSec ? ` (longest ${duration(s.longestSec)})` : ""}` : null,
    s.messages ? `${s.messages} message${s.messages > 1 ? "s" : ""}` : null,
    s.tasksAdded ? `${s.tasksAdded} task${s.tasksAdded > 1 ? "s" : ""}${s.tasksDone ? `, ${s.tasksDone} done` : ""}` : null,
    s.shares ? `shared ${s.shares}×` : null,
    s.focusDone ? `finished ${s.focusDone} focus session${s.focusDone > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return (
    <li className={`rounded-xl border px-3 py-2.5 ${s.inRoomNow ? "border-rose-400/40 bg-rose-500/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm">
              <span className="font-medium">{s.name ?? s.v}</span>
              {s.name && <span className="ml-1.5 text-xs text-white/30">{s.v}</span>}
              {s.inRoomNow && <span className="ml-2 text-xs text-rose-200">● in {s.inRoomNow} now</span>}
            </span>
            <span className="text-xs text-white/40 tabular-nums">{when(s.first, now)}{s.last - s.first > 60_000 ? ` – ${when(s.last, now)}` : ""}</span>
          </div>
          <p className="mt-0.5 text-xs text-white/50">{facts.join(" · ")}</p>
          <p className="mt-0.5 text-xs text-white/75">{did.length ? did.join(" · ") : `looked around (${s.pages} page${s.pages === 1 ? "" : "s"})`}</p>
        </summary>
        <ol className="mt-2 border-t border-white/5 pt-2 space-y-0.5 font-mono text-[11px] text-white/55">
          {s.lines.map((l, i) => (
            <li key={i} className="break-words"><span className="text-white/30">{clock(l.t)}</span> {l.msg}</li>
          ))}
        </ol>
      </details>
    </li>
  );
}
