"use client";

import { useEffect, useState } from "react";
import { createRoom } from "@/lib/api";
import { getUserId } from "@/components/NamePrompt";

const PRESETS = [
  { focus: 25, brk: 5 },
  { focus: 50, brk: 10 },
  { focus: 60, brk: 10 },
  { focus: 90, brk: 15 },
  { focus: 120, brk: 20 },
];
const STORE_KEY = "pikoo:obs-room";

// Lets a streamer create a host-only room and copy its overlay URL for OBS
export function ObsBuilder() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [preset, setPreset] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transparent, setTransparent] = useState(true);
  const [showLink, setShowLink] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setOrigin(window.location.origin);
      try { const saved = localStorage.getItem(STORE_KEY); if (saved) setRoomId(saved); } catch { /* storage blocked */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const p = PRESETS[preset];
      const { roomId: id } = await createRoom({ focusSec: p.focus * 60, breakSec: p.brk * 60, mode: "host" }, getUserId(), slug.trim() || undefined);
      setRoomId(id);
      try { localStorage.setItem(STORE_KEY, id); } catch { /* storage blocked */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create a room");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch { /* blocked */ }
  };

  const query = [transparent && "bg=transparent", !showLink && "link=0"].filter(Boolean).join("&");
  const overlayUrl = roomId ? `${origin}/embed/${roomId}${query ? `?${query}` : ""}` : "";
  const roomUrl = roomId ? `${origin}/r/${roomId}` : "";
  const chip = (on: boolean) => `h-9 px-4 rounded-full text-sm border transition-colors ${on ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/75 hover:bg-white/10"}`;

  if (!roomId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold">1. Create your stream timer</h2>
        <p className="mt-1 text-sm text-white/55">While your controls are open, only you can start, pause or skip it. Viewers who open the link focus on the same timer.</p>
        <p className="mt-5 text-xs text-white/60 mb-2">Focus / break</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button key={i} onClick={() => setPreset(i)} className={chip(preset === i)}>{p.focus}/{p.brk}</button>
          ))}
        </div>
        <label htmlFor="obs-slug" className="block mt-5 text-xs text-white/60 mb-2">Custom link (optional)</label>
        <div className="flex items-center rounded-xl bg-white/5 border border-white/10 focus-within:border-rose-500/50">
          <span className="pl-3 text-sm text-white/40 whitespace-nowrap">{origin.replace(/^https?:\/\//, "")}/r/</span>
          <input
            id="obs-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 32))}
            placeholder="your-channel"
            className="flex-1 min-w-0 bg-transparent py-2.5 pr-3 text-sm outline-none"
          />
        </div>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button onClick={create} disabled={creating} className="mt-6 w-full sm:w-auto h-11 px-6 rounded-full bg-rose-500 hover:bg-rose-400 font-medium disabled:opacity-50">
          {creating ? "Creating…" : "Create stream timer"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">2. Add it to OBS</h2>
            <p className="mt-1 text-sm text-white/55">Copy this link into a Browser source.</p>
          </div>
          <button
            onClick={() => { setRoomId(null); try { localStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ } }}
            className="text-xs text-white/40 hover:text-white/75 whitespace-nowrap"
          >
            New timer
          </button>
        </div>

        {/* Preview over a stand-in stream background */}
        <div className="mt-5 relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-[linear-gradient(135deg,#3b2f2a,#1d2833_55%,#2b1f2e)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(255,200,120,0.25),transparent_45%)]" />
          <span className="absolute left-3 top-3 text-[10px] uppercase tracking-widest text-white/40">Preview</span>
          <iframe
            key={overlayUrl}
            src={overlayUrl}
            title="Timer overlay preview"
            className={`absolute right-3 bottom-3 w-[46%] aspect-[2/1] ${transparent ? "" : "rounded-lg"}`}
            style={{ colorScheme: "normal", background: "transparent" }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setTransparent((v) => !v)} className={chip(transparent)}>Transparent background</button>
          <button onClick={() => setShowLink((v) => !v)} className={chip(showLink)}>Show &ldquo;focus with us&rdquo; link</button>
        </div>

        <div className="mt-4 flex gap-2">
          <input readOnly value={overlayUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Overlay URL" className="flex-1 min-w-0 rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm font-mono text-white/80" />
          <button onClick={() => copy("overlay", overlayUrl)} className="h-11 px-5 rounded-full bg-rose-500 hover:bg-rose-400 text-sm font-medium whitespace-nowrap">
            {copied === "overlay" ? "Copied!" : "Copy"}
          </button>
        </div>

        <ol className="mt-5 space-y-2 text-sm text-white/65 list-decimal list-inside">
          <li>In OBS, under <b className="text-white/85">Sources</b>, click <b className="text-white/85">+</b> → <b className="text-white/85">Browser</b>.</li>
          <li>Paste the link into <b className="text-white/85">URL</b>. Set width <b className="text-white/85">600</b> and height <b className="text-white/85">300</b>, then resize it on your scene.</li>
          <li>Leave &ldquo;Custom CSS&rdquo; as it is. The background is already transparent.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold">3. Run the timer and invite your chat</h2>
        <p className="mt-1 text-sm text-white/55">
          Keep your timer controls open during the stream (a second screen or your phone works). Pin the room link in chat: viewers who open it see the same countdown and can add their own goals, but can&apos;t pause your timer while you&apos;re there.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/r/${roomId}`} target="_blank" rel="noopener" className="h-10 px-5 inline-flex items-center rounded-full bg-white text-black text-sm font-medium hover:bg-white/90">Open my timer controls</a>
          <button onClick={() => copy("room", roomUrl)} className="h-10 px-5 rounded-full bg-white/10 hover:bg-white/20 text-sm">
            {copied === "room" ? "Copied!" : "Copy link for chat"}
          </button>
        </div>
        <p className="mt-3 text-xs text-white/40">Rooms stay around for 30 days after they&apos;re last used, so the same overlay link works for every stream.</p>
      </div>
    </div>
  );
}
