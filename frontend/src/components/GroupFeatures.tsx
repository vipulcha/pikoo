"use client";

import { useEffect, useRef, useState } from "react";
import { RoomSchedule, ScheduleRepeat, WeeklyEntry } from "@/lib/types";
import { REPEAT_LABEL, formatWhen, googleCalendarUrl, icsContent, isoWeekKey, nextOccurrence } from "@/lib/schedule";
import { formatDuration } from "@/lib/hooks/useFocusStats";

const pill = "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors";

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [intervalMs]);
  return now;
}

function downloadIcs(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "pikoo-focus-session.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Schedule: chip above the timer + edit dialog
// ---------------------------------------------------------------------------

export function ScheduleChip({ schedule, roomUrl, roomName, canEdit, onEdit }: {
  schedule: RoomSchedule | null | undefined; roomUrl: string; roomName: string; canEdit: boolean; onEdit: () => void;
}) {
  const now = useNow();
  if (!now) return null;

  if (!schedule) return null;
  const next = nextOccurrence(schedule, now);
  if (next === null) return null;
  const live = next <= now;
  const title = `Focus session · ${roomName}`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <span className={`${pill} ${live ? "bg-green-500/15 text-green-300 border border-green-500/30" : "bg-white/5 text-white/70 border border-white/10"}`}>
        <span aria-hidden>📅</span>
        {live ? "Session happening now" : `Next session ${formatWhen(next, now)}`}
        {schedule.repeat !== "none" && <span className="text-white/40">· {REPEAT_LABEL[schedule.repeat].toLowerCase()}</span>}
      </span>
      <a href={googleCalendarUrl(schedule, next, title, roomUrl)} target="_blank" rel="noopener" className={`${pill} bg-white/5 hover:bg-white/10 border border-white/10 text-white/70`}>
        Add to Google Calendar
      </a>
      <button onClick={() => downloadIcs(icsContent(schedule, next, title, roomUrl))} className={`${pill} bg-white/5 hover:bg-white/10 border border-white/10 text-white/70`}>
        .ics
      </button>
      {canEdit && <button onClick={onEdit} className="text-white/40 hover:text-white/75 px-1">Edit</button>}
    </div>
  );
}

const toLocalInput = (t: number) => {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ScheduleDialog({ open, schedule, onSave, onClear, onClose }: {
  open: boolean; schedule: RoomSchedule | null | undefined;
  onSave: (s: RoomSchedule) => void; onClear: () => void; onClose: () => void;
}) {
  const [when, setWhen] = useState("");
  const [repeat, setRepeat] = useState<ScheduleRepeat>("daily");
  const [duration, setDuration] = useState(60);

  // Fill the form each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      setWhen(toLocalInput(schedule?.startsAt ?? nextHour.getTime()));
      setRepeat(schedule?.repeat ?? "daily");
      setDuration(schedule?.durationMin ?? 60);
    }, 0);
    return () => clearTimeout(t);
  }, [open, schedule]);

  if (!open) return null;
  const startsAt = when ? new Date(when).getTime() : NaN;
  const valid = Number.isFinite(startsAt);
  const field = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-rose-500/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Schedule a session">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        className="relative w-full max-w-sm rounded-2xl bg-neutral-900/95 border border-white/10 p-6 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave({ startsAt, repeat, durationMin: duration, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
        }}
      >
        <h2 className="text-lg font-semibold">Schedule a session</h2>
        <p className="mt-1 text-sm text-white/50">Everyone in the room sees it and can add it to their calendar. The room link stays the same.</p>
        <label className="block mt-5 text-xs text-white/60 mb-1.5" htmlFor="sched-when">Starts</label>
        <input id="sched-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} [color-scheme:dark]`} required />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1.5" htmlFor="sched-repeat">Repeats</label>
            <select id="sched-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as ScheduleRepeat)} className={`${field} [color-scheme:dark]`}>
              {(Object.keys(REPEAT_LABEL) as ScheduleRepeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1.5" htmlFor="sched-dur">Length</label>
            <select id="sched-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={`${field} [color-scheme:dark]`}>
              {[30, 45, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          {schedule ? (
            <button type="button" onClick={onClear} className="text-sm text-white/45 hover:text-rose-300">Remove schedule</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-full text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button type="submit" disabled={!valid} className="h-10 px-5 rounded-full text-sm font-medium bg-rose-500 hover:bg-rose-400 disabled:opacity-50">Save</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly leaderboard
// ---------------------------------------------------------------------------

// "⋯" menu in the room header for the less-used group features
export function RoomMoreMenu({ onLeaderboard, onSchedule, onFeedback, hasSchedule }: {
  onLeaderboard: () => void; onSchedule?: () => void; onFeedback: () => void; hasSchedule: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const item = "w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors";
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`h-9 w-9 flex items-center justify-center rounded-full border transition-colors ${open ? "bg-white/20 border-white/20 text-white" : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"}`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 p-1.5 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-white/10 shadow-2xl z-50 text-sm animate-fade-in">
          <button role="menuitem" className={item} onClick={pick(onLeaderboard)}><span aria-hidden>🏆</span>This week&apos;s leaderboard</button>
          {onSchedule && (
            <button role="menuitem" className={item} onClick={pick(onSchedule)}><span aria-hidden>📅</span>{hasSchedule ? "Edit session schedule" : "Schedule a session"}</button>
          )}
          <div className="my-1 h-px bg-white/10" />
          <button role="menuitem" className={`${item} text-white/70`} onClick={pick(onFeedback)}><span aria-hidden>💡</span>Send a suggestion</button>
        </div>
      )}
    </div>
  );
}

export function LeaderboardDialog({ open, weekly, myId, roomUrl, onClose }: {
  open: boolean; weekly: Record<string, Record<string, WeeklyEntry>> | undefined; myId: string; roomUrl: string; onClose: () => void;
}) {
  const now = useNow(60_000);
  const [which, setWhich] = useState<"this" | "last">("this");
  const [copied, setCopied] = useState(false);
  if (!open || !now) return null;

  const key = isoWeekKey(which === "this" ? now : now - 7 * 86_400_000);
  const rows = Object.entries(weekly?.[key] ?? {})
    .map(([uid, e]) => ({ uid, ...e }))
    .sort((a, b) => b.sec - a.sec);

  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;
  const shareText = rows.length
    ? `🏆 Our focus leaderboard ${which === "this" ? "this week" : "last week"} on Pikoo:\n${rows.slice(0, 10).map((r, i) => `${medal(i)} ${r.name}: ${formatDuration(r.sec)} (${r.sessions} sessions)`).join("\n")}\n\nJoin us: ${roomUrl}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Weekly leaderboard">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-neutral-900/95 border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🏆 Focus leaderboard</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="mt-4 inline-flex rounded-full bg-white/5 p-1 text-xs">
          {(["this", "last"] as const).map((w) => (
            <button key={w} onClick={() => setWhich(w)} className={`px-3 py-1.5 rounded-full ${which === w ? "bg-white/15 text-white" : "text-white/50"}`}>
              {w === "this" ? "This week" : "Last week"}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="mt-6 mb-2 text-sm text-white/50">
            No completed sessions {which === "this" ? "yet this week" : "last week"}. Everyone in the room when a focus session runs out gets its time here.
          </p>
        ) : (
          <ol className="mt-4 space-y-1.5">
            {rows.map((r, i) => (
              <li key={r.uid} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.uid === myId ? "bg-rose-500/10 border border-rose-500/20" : "bg-white/[0.03]"}`}>
                <span className="w-6 text-center">{medal(i)}</span>
                <span className="flex-1 truncate text-sm">{r.name}{r.uid === myId && <span className="text-white/40"> (you)</span>}</span>
                <span className="text-sm font-mono tabular-nums">{formatDuration(r.sec)}</span>
                <span className="text-xs text-white/40 w-10 text-right">{r.sessions}×</span>
              </li>
            ))}
          </ol>
        )}

        {shareText && (
          <div className="mt-5 flex gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener" className="flex-1 h-10 inline-flex items-center justify-center rounded-full text-sm font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200">
              Share on WhatsApp
            </a>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* blocked */ } }}
              className="h-10 px-4 rounded-full text-sm bg-white/10 hover:bg-white/20"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
        <p className="mt-4 text-[11px] text-white/35">Weeks run Monday to Sunday (UTC).</p>
      </div>
    </div>
  );
}
