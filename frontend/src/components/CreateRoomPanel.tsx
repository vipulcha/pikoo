"use client";

import { trace } from "@/lib/trace";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { RoomSettings, DEFAULT_SETTINGS } from "@/lib/types";
import { getUserId } from "@/components/NamePrompt";
import { roomExists, roomNameProblem, toRoomName } from "@/lib/roomNames";

type NameStatus = "idle" | "checking" | "free" | "taken" | "unknown";

export function CreateRoomPanel({ reserved = [] }: { reserved?: string[] }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<NameStatus>("idle");
  const [host, setHost] = useState("");

  const name = slug.replace(/^-+|-+$/g, "");
  const problem = name ? roomNameProblem(name, reserved) : null;

  useEffect(() => {
    const t = setTimeout(() => setHost(window.location.host), 0);
    return () => clearTimeout(t);
  }, []);

  // Is the name free? Checked once typing pauses
  useEffect(() => {
    if (!name || problem) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("checking");
      const exists = await roomExists(name, ctrl.signal);
      if (!ctrl.signal.aborted) setStatus(exists === null ? "unknown" : exists ? "taken" : "free");
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); setStatus("idle"); };
  }, [name, problem]);

  // The room asks for a person's name on arrival, so creating a room needs no prompt here
  const handleCreateRoom = async () => {
    if (name && problem) {
      setError(problem);
      return;
    }
    if (name && status === "taken") return;
    setIsCreating(true);
    setError(null);
    trace("create_room", { custom: showSettings ? "yes" : "no", slug: name || undefined });
    try {
      const { roomId } = await createRoom(settings, getUserId(), name || undefined);
      router.push(`/r/${roomId}`);
    } catch (err) {
      console.error("Failed to create room:", err);
      const msg = err instanceof Error ? err.message : "";
      trace("error", { where: "create_room", msg: msg || "unknown" });
      if (name && /taken/i.test(msg)) setStatus("taken");
      else setError(msg || "Couldn't create a room. Please try again.");
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-md mx-auto text-center">
        {showSettings ? (
          <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-medium">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6 text-left">
              <div>
                <label className="block text-xs sm:text-sm text-white/60 mb-1.5 sm:mb-2">Focus</label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={settings.focusSec / 60}
                    onChange={(e) => setSettings({ ...settings, focusSec: Number(e.target.value) * 60 })}
                    className="flex-1 accent-rose-500"
                  />
                  <span className="w-10 sm:w-16 text-right font-mono text-sm">{settings.focusSec / 60}m</span>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-white/60 mb-1.5 sm:mb-2">Break</label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={settings.breakSec / 60}
                    onChange={(e) => setSettings({ ...settings, breakSec: Number(e.target.value) * 60 })}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-10 sm:w-16 text-right font-mono text-sm">{settings.breakSec / 60}m</span>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-white/60 mb-1.5 sm:mb-2">Long Break</label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="range"
                    min="5"
                    max="45"
                    value={settings.longBreakSec / 60}
                    onChange={(e) => setSettings({ ...settings, longBreakSec: Number(e.target.value) * 60 })}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="w-10 sm:w-16 text-right font-mono text-sm">{settings.longBreakSec / 60}m</span>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-white/60 mb-1.5 sm:mb-2">Long Break After</label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={settings.longBreakEvery}
                    onChange={(e) => setSettings({ ...settings, longBreakEvery: Number(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="w-10 sm:w-16 text-right font-mono text-sm whitespace-nowrap">{settings.longBreakEvery}x</span>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-white/60 mb-2 sm:mb-3">Control Mode</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={() => setSettings({ ...settings, mode: "collab" })}
                    className={`
                      p-2.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all text-sm
                      ${settings.mode === "collab"
                        ? "border-purple-500 bg-purple-500/20 text-white"
                        : "border-white/10 text-white/60 hover:border-white/20"
                      }
                    `}
                  >
                    <div className="font-medium text-xs sm:text-sm mb-0.5">Collab</div>
                    <div className="text-[10px] sm:text-xs opacity-70">Anyone controls</div>
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, mode: "host" })}
                    className={`
                      p-2.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all text-sm
                      ${settings.mode === "host"
                        ? "border-purple-500 bg-purple-500/20 text-white"
                        : "border-white/10 text-white/60 hover:border-white/20"
                      }
                    `}
                  >
                    <div className="font-medium text-xs sm:text-sm mb-0.5">Host Only</div>
                    <div className="text-[10px] sm:text-xs opacity-70">You control</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {/* Optional room name: gives the room a link anyone can type */}
          <div id="name-your-room" className="scroll-mt-24 text-left">
            <label htmlFor="room-name" className="sr-only">Name your room (optional)</label>
            <div className={`flex items-center h-11 rounded-full border bg-white/5 px-4 transition-colors focus-within:border-rose-400/60 ${
              name && (problem || status === "taken") ? "border-amber-300/40" : "border-white/15"
            }`}>
              <svg className="w-4 h-4 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              <input
                id="room-name"
                value={slug}
                onChange={(e) => { setSlug(toRoomName(e.target.value)); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoom(); }}
                placeholder="Name your room (optional)"
                className="flex-1 min-w-0 bg-transparent pl-2.5 text-sm text-white outline-none placeholder:text-white/40"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                aria-describedby="room-name-status"
              />
            </div>
            <p id="room-name-status" aria-live="polite" className="mt-1.5 px-4 min-h-[1.25rem] text-xs text-white/45 truncate">
              {!name ? (
                "Get a link anyone can type, like study-buddies"
              ) : problem ? (
                <span className="text-amber-200/90">{problem}</span>
              ) : status === "taken" ? (
                <span className="text-amber-200/90">
                  Already taken.{" "}
                  <button type="button" onClick={() => router.push(`/r/${name}`)} className="underline underline-offset-2 hover:text-white">Join it</button>
                  {" "}or pick another name.
                </span>
              ) : (
                <>
                  <span className="font-mono text-white/70">{host || "pikoo"}/{name}</span>
                  {status === "free" && <span className="text-emerald-300"> · available</span>}
                  {status === "checking" && <span> · checking…</span>}
                </>
              )}
            </p>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={isCreating || (!!name && status === "taken")}
            className={`
              w-full py-3 px-6 sm:py-4 sm:px-8 rounded-full font-semibold text-base sm:text-lg
              bg-gradient-to-r from-rose-500 to-pink-500 
              hover:from-rose-400 hover:to-pink-400
              active:from-rose-600 active:to-pink-600
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 
              shadow-xl sm:shadow-2xl shadow-rose-500/30 animate-glow-pulse
              sm:hover:scale-105 active:scale-[0.98]
              sm:hover:shadow-rose-500/50
            `}
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </span>
            ) : name && !problem && status !== "taken" ? (
              <span className="block truncate">Create &ldquo;{name}&rdquo;</span>
            ) : (
              "Create focus room"
            )}
          </button>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          {!showSettings && (
            <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-white/55 whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                No sign-up required
              </span>
              <span className="text-white/20" aria-hidden>·</span>
              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Customize timer
              </button>
            </div>
          )}
        </div>
      </div>

    </>
  );
}

export function CreateRoomButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const { roomId } = await createRoom(undefined, getUserId());
      router.push(`/r/${roomId}`);
    } catch (err) {
      console.error("Failed to create room:", err);
      setError("Couldn't create a room. Please try again.");
      setIsCreating(false);
    }
  };

  return (
    <>
      <button
        onClick={handleCreateRoom}
        disabled={isCreating}
        className="px-8 py-3 sm:px-10 sm:py-4 rounded-full font-semibold text-base sm:text-lg bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 active:from-rose-600 active:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl sm:shadow-2xl shadow-rose-500/30 sm:hover:scale-105 active:scale-[0.98] sm:hover:shadow-rose-500/50"
      >
        {isCreating ? "Creating..." : "Create focus room"}
      </button>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </>
  );
}
