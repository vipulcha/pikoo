"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { RoomSettings, DEFAULT_SETTINGS } from "@/lib/types";
import { NamePrompt, getSavedName } from "@/components/NamePrompt";

export function CreateRoomPanel() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);

  const handleCreateRoom = async () => {
    const savedName = getSavedName();
    if (!savedName) {
      setShowNamePrompt(true);
      return;
    }
    proceedToCreateRoom();
  };

  const handleNameSubmit = () => {
    setShowNamePrompt(false);
    proceedToCreateRoom();
  };

  const proceedToCreateRoom = async () => {
    setIsCreating(true);
    try {
      const { roomId } = await createRoom(settings);
      router.push(`/r/${roomId}`);
    } catch (err) {
      console.error("Failed to create room:", err);
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
        ) : (
          <div className="mb-10">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/70 text-xs sm:text-sm mb-6 sm:mb-8 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              No sign-up required
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
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
            ) : (
              "Create focus room"
            )}
          </button>

          {!showSettings && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-white/50 hover:text-white transition-all text-sm tracking-wide"
            >
              ⚙️ Customize Settings
            </button>
          )}
        </div>
      </div>

      <NamePrompt
        isOpen={showNamePrompt}
        onSubmit={handleNameSubmit}
        title="What's your name?"
        subtitle="This will be shown to others in the room"
      />
    </>
  );
}

export function CreateRoomButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const handleCreateRoom = async () => {
    const savedName = getSavedName();
    if (!savedName) {
      setShowNamePrompt(true);
      return;
    }
    proceedToCreateRoom();
  };

  const handleNameSubmit = () => {
    setShowNamePrompt(false);
    proceedToCreateRoom();
  };

  const proceedToCreateRoom = async () => {
    setIsCreating(true);
    try {
      const { roomId } = await createRoom();
      router.push(`/r/${roomId}`);
    } catch (err) {
      console.error("Failed to create room:", err);
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

      <NamePrompt
        isOpen={showNamePrompt}
        onSubmit={handleNameSubmit}
        title="What's your name?"
        subtitle="This will be shown to others in the room"
      />
    </>
  );
}
