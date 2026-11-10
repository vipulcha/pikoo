"use client";

import { useState } from "react";
import { Phase } from "@/lib/types";
import { FocusStats, formatDuration } from "@/lib/hooks/useFocusStats";
import { roomUrl, whatsappUrl } from "./ShareButton";

const card = "mt-6 w-full max-w-md mx-auto rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md px-5 py-4 shadow-xl";
const btn = "h-9 px-4 rounded-full text-sm font-medium transition-colors";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
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
  return (
    <div className={card} role="note">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">Focusing solo?</p>
          <p className="mt-0.5 text-sm text-white/55">It&apos;s easier to stay on track with someone else in the room.</p>
        </div>
        <button onClick={onDismiss} className="text-white/40 hover:text-white/80 -mt-1" aria-label="Dismiss">✕</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => copy(roomUrl(roomId))} className={`${btn} bg-white/10 hover:bg-white/20 text-white`}>
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
        <a href={whatsappUrl(roomId)} target="_blank" rel="noopener" className={`${btn} inline-flex items-center bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200`}>
          Invite on WhatsApp
        </a>
      </div>
    </div>
  );
}

// Shown during the break after a focus session ran to the end
export function SessionSummary({
  roomId, stats, others, phase, onDismiss,
}: { roomId: string; stats: FocusStats; others: number; phase: Phase; onDismiss: () => void }) {
  const [sharing, setSharing] = useState(false);
  const minutes = Math.max(1, Math.round(stats.seconds / 60));
  const imageUrl = `/api/recap?m=${minutes}&s=${stats.sessions}&w=${others}`;
  const text = `I focused ${formatDuration(minutes * 60)} today on Pikoo${others > 0 ? ` with ${others} other${others > 1 ? "s" : ""}` : ""}. Join me: ${roomUrl(roomId)}`;

  const share = async () => {
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
          <p className="mt-1 text-white">
            <span className="text-2xl font-semibold">{formatDuration(minutes * 60)}</span>
            <span className="text-white/55"> focused today · {stats.sessions} session{stats.sessions === 1 ? "" : "s"}</span>
          </p>
          {others > 0 && <p className="text-sm text-white/45">with {others} other{others > 1 ? "s" : ""} in this room</p>}
        </div>
        <button onClick={onDismiss} className="text-white/40 hover:text-white/80 -mt-1" aria-label="Dismiss">✕</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={share} disabled={sharing} className={`${btn} bg-white text-black hover:bg-white/85 disabled:opacity-60`}>
          {sharing ? "Preparing…" : "Share my progress"}
        </button>
        <a href={whatsappUrl(roomId)} target="_blank" rel="noopener" className={`${btn} inline-flex items-center bg-white/10 hover:bg-white/20 text-white`}>
          Invite a friend
        </a>
      </div>
    </div>
  );
}
