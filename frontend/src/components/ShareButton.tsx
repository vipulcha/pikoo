"use client";

import { trace } from "@/lib/trace";
import { useEffect, useRef, useState } from "react";

interface ShareButtonProps {
  roomId: string;
}

export const roomUrl = (roomId: string) => `${window.location.origin}/r/${roomId}`;
export const inviteText = (roomId: string) => `Focus with me on Pikoo (shared Pomodoro timer, free, no sign-up): ${roomUrl(roomId)}`;
export const whatsappUrl = (roomId: string) => `https://wa.me/?text=${encodeURIComponent(inviteText(roomId))}`;

export function ShareButton({ roomId }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const copy = async (key: string, text: string) => {
    trace("share", { how: key, room: roomId });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context); leave the menu open so the user can retry
    }
  };

  const embedUrl = (transparent: boolean) =>
    `${window.location.origin}/embed/${roomId}${transparent ? "?bg=transparent" : ""}`;

  const item = "w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { if (!open) trace("click", { what: "share_menu", room: roomId }); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`
          h-9 flex items-center gap-2 px-3 sm:px-4 rounded-full text-sm font-medium transition-all duration-200
          ${copied
            ? "bg-green-500/20 border border-green-500/50 text-green-300"
            : "bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white"
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
        <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 p-1.5 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-white/10 shadow-2xl z-50 text-sm">
          <button role="menuitem" className={item} onClick={() => copy("link", roomUrl(roomId))}>
            <div className="font-medium text-white">{copied === "link" ? "Copied!" : "Copy room link"}</div>
            <div className="text-xs text-white/45">Anyone with the link can join</div>
          </button>
          <a role="menuitem" className={`${item} block`} href={whatsappUrl(roomId)} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            <div className="font-medium text-white">Share on WhatsApp</div>
            <div className="text-xs text-white/45">Send the invite to a chat or group</div>
          </a>
          <div className="my-1 h-px bg-white/10" />
          <button role="menuitem" className={item} onClick={() => copy("embed", embedUrl(false))}>
            <div className="font-medium text-white">{copied === "embed" ? "Copied!" : "Copy timer for Notion"}</div>
            <div className="text-xs text-white/45">Paste in Notion and choose “Embed”. View-only</div>
          </button>
          <button role="menuitem" className={item} onClick={() => copy("obs", embedUrl(true))}>
            <div className="font-medium text-white">{copied === "obs" ? "Copied!" : "Copy timer for streaming"}</div>
            <div className="text-xs text-white/45">Transparent overlay: add as a Browser Source in OBS</div>
          </button>
        </div>
      )}
    </div>
  );
}
