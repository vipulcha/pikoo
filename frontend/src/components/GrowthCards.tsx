"use client";

import { trace } from "@/lib/trace";
import { useState } from "react";
import { Phase } from "@/lib/types";
import { FocusStats, formatDuration } from "@/lib/hooks/useFocusStats";
import { roomUrl, whatsappUrl } from "./ShareButton";

const btn = "h-9 px-4 rounded-full text-sm font-medium transition-colors";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    trace("share", { how: "copy_link" });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; nothing else to do
    }
  };
  return { copied, copy };
}

// Shown when you're the only one in the room
export function InviteNudge({ roomId, onDismiss }: { roomId: string; onDismiss: () => void }) {
  const { copied, copy } = useCopy();
  const chip = "h-8 px-3 whitespace-nowrap rounded-full text-xs font-medium transition-colors";
  return (
    <div role="note" className="mt-6 mx-auto w-fit max-w-full flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md pl-4 pr-1.5 py-1.5 text-sm text-white/60">
      <span className="whitespace-nowrap"><span className="sm:hidden">Invite a friend</span><span className="hidden sm:inline">Focus better with a friend</span></span>
      <button onClick={() => copy(roomUrl(roomId))} className={`${chip} bg-white/10 hover:bg-white/20 text-white`}>
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a href={whatsappUrl(roomId)} target="_blank" rel="noopener" className={`${chip} inline-flex items-center bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200`}>
        WhatsApp
      </a>
      <button onClick={onDismiss} className="w-7 h-7 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10" aria-label="Dismiss">✕</button>
    </div>
  );
}

// Shown during the break after a focus session ran to the end
export function SessionSummary({
  shareUrl, stats, others, phase, onDismiss, canEnableNotifications, onEnableNotifications,
}: {
  shareUrl: string; stats: FocusStats; others: number; phase: Phase; onDismiss: () => void;
  canEnableNotifications?: boolean; onEnableNotifications?: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [notifAsked, setNotifAsked] = useState(false);
  const minutes = Math.max(1, Math.round(stats.seconds / 60));
  const imageUrl = `/api/recap?m=${minutes}&s=${stats.sessions}&w=${others}`;
  const text = `I focused ${formatDuration(minutes * 60)} today on Pikoo${others > 0 ? ` with ${others} other${others > 1 ? "s" : ""}` : ""}. Join me: ${shareUrl}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Focus with me on Pikoo (free, no sign-up): ${shareUrl}`)}`;

  const share = async () => {
    trace("share", { how: "progress_image", minutes });
    setSharing(true);
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], "pikoo-focus.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        window.open(imageUrl, "_blank", "noopener");
      }
    } catch {
      // Share sheet dismissed or unsupported; nothing to do
    } finally {
      setSharing(false);
    }
  };

  const accent = phase === "long_break" ? "text-blue-300" : "text-emerald-300";

  return (
    <div
      role="status"
      className="fixed z-40 left-1/2 -translate-x-1/2 bottom-20 w-[calc(100%-2rem)] max-w-md sm:left-6 sm:translate-x-0 sm:bottom-6 sm:max-w-sm rounded-2xl border border-white/15 bg-black/80 backdrop-blur-md px-5 py-4 shadow-2xl animate-slide-up"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${accent}`}>Session done</p>
          {stats.lastSessionSec !== undefined && stats.lastSessionSec >= 60 ? (
            <>
              <p className="mt-1 text-white">
                <span className="text-2xl font-semibold">{formatDuration(Math.round(stats.lastSessionSec / 60) * 60)}</span>
                <span className="text-white/55"> this session</span>
              </p>
              <p className="text-sm text-white/45">{formatDuration(minutes * 60)} today · {stats.sessions} session{stats.sessions === 1 ? "" : "s"}</p>
            </>
          ) : (
            <p className="mt-1 text-white">
              <span className="text-2xl font-semibold">{formatDuration(minutes * 60)}</span>
              <span className="text-white/55"> focused today · {stats.sessions} session{stats.sessions === 1 ? "" : "s"}</span>
            </p>
          )}
          {others > 0 && <p className="text-sm text-white/45">with {others} other{others > 1 ? "s" : ""} in this room</p>}
        </div>
        <button onClick={onDismiss} className="text-white/40 hover:text-white/80 -mt-1" aria-label="Dismiss">✕</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={share} disabled={sharing} className={`${btn} bg-white text-black hover:bg-white/85 disabled:opacity-60`}>
          {sharing ? "Preparing…" : "Share my progress"}
        </button>
        <a href={whatsapp} target="_blank" rel="noopener" className={`${btn} inline-flex items-center bg-white/10 hover:bg-white/20 text-white`}>
          Invite a friend
        </a>
      </div>
      {canEnableNotifications && !notifAsked && (
        <button
          onClick={() => { setNotifAsked(true); onEnableNotifications?.(); }}
          className="mt-3 text-xs text-white/50 hover:text-white/80 underline underline-offset-2"
        >
          Get a notification when the break ends
        </button>
      )}
    </div>
  );
}
