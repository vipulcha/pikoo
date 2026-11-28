"use client";

// Pieces of the work-with-dev room (/work-with-dev) used around the site
import Link from "next/link";
import { useEffect, useState } from "react";
import { DEV_PATH, DEV_HOST_SECRET_SHA256, DevRoomStatus, fetchDevStatus, sinceLabel } from "@/lib/devRoom";
import { getUserSecret } from "@/components/NamePrompt";
import { trace } from "@/lib/trace";

/** True in the developer's own browser (shows their controls; the server checks the secret itself) */
export async function isDevBrowser(): Promise<boolean> {
  try {
    const secret = getUserSecret();
    if (!secret || !crypto?.subtle) return false;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    return hex === DEV_HOST_SECRET_SHA256;
  } catch {
    return false;
  }
}

/** The dev room's status, fetched on mount and every pollMs while the tab is visible */
export function useDevStatus(pollMs = 60_000, enabled = true): DevRoomStatus | undefined {
  const [status, setStatus] = useState<DevRoomStatus | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const load = async () => {
      if (document.hidden) return;
      const s = await fetchDevStatus();
      if (!stopped && s) setStatus(s);
    };
    void load();
    const id = setInterval(load, pollMs);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [pollMs, enabled]);
  return status;
}

/** Re-renders every minute (for "live for 35 min") */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** "The developer of Pikoo is focusing live" pill; renders nothing while they're offline */
export function DevLiveBadge({ from, className = "" }: { from: string; className?: string }) {
  const status = useDevStatus();
  if (!status?.live) return null;
  const others = Math.max(0, status.people - 1);
  return (
    <Link
      href={DEV_PATH}
      onClick={() => trace("click", { what: "dev_live_badge", from })}
      className={`inline-flex items-center gap-2 h-9 px-4 rounded-full border border-rose-400/40 bg-rose-500/15 text-sm text-rose-100 hover:bg-rose-500/25 transition-colors animate-fade-in ${className}`}
    >
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex w-full h-full rounded-full bg-rose-400 opacity-75 animate-ping" />
        <span className="relative inline-flex w-2 h-2 rounded-full bg-rose-400" />
      </span>
      <span>
        The developer of Pikoo is focusing live
        <span className="text-rose-200/70">{others > 0 ? ` · ${others} with them` : ""}</span>
      </span>
      <span aria-hidden>→</span>
    </Link>
  );
}

/** Small live indicator in the dev room's header */
export function DevLiveChip({ live, since }: { live: boolean; since: number | null }) {
  const now = useMinuteClock();
  return (
    <span
      className={`h-9 hidden sm:flex items-center gap-2 px-3 rounded-full border text-sm ${live ? "border-rose-400/40 bg-rose-500/15 text-rose-100" : "border-white/10 bg-white/5 text-white/50"}`}
      title={live ? "The developer of Pikoo is live in this room" : "Not live"}
    >
      <span className={`w-2 h-2 rounded-full ${live ? "bg-rose-400 animate-pulse" : "bg-white/30"}`} />
      {live ? <>Live{since ? <span className="text-rose-200/70"> · {sinceLabel(since, now)}</span> : null}</> : "Offline"}
    </span>
  );
}

/** The developer's own controls: go live / end the session */
export function DevHostBar({ live, since, people, onGoLive, onEnd }: {
  live: boolean;
  since: number | null;
  people: number;
  onGoLive: () => void;
  onEnd: () => void;
}) {
  const now = useMinuteClock();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const others = Math.max(0, people - 1);
  return (
    <div className="relative z-10 mx-4 sm:mx-auto sm:w-fit flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl sm:rounded-full border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-2.5 text-sm">
      {live ? (
        <>
          <span className="flex items-center gap-2 text-rose-100">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            Live for {since ? sinceLabel(since, now) : "0 min"} · {others === 0 ? "nobody else yet" : `${others} ${others === 1 ? "person" : "people"} with you`}
          </span>
          {confirmEnd ? (
            <span className="flex items-center gap-2">
              <button onClick={() => { setConfirmEnd(false); onEnd(); }} className="h-8 px-3 rounded-full bg-red-500 hover:bg-red-400 text-white font-medium">End session</button>
              <button onClick={() => setConfirmEnd(false)} className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/15 text-white/80">Keep going</button>
            </span>
          ) : (
            <button onClick={() => setConfirmEnd(true)} className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/15 text-white/85">End session</button>
          )}
        </>
      ) : (
        <>
          <span className="text-white/60">You&apos;re offline. Visitors see the &ldquo;not live&rdquo; page.</span>
          <button onClick={onGoLive} className="h-8 px-4 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white" />
            Go live
          </button>
        </>
      )}
    </div>
  );
}
