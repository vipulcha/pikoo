"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { RoomSettings, DEFAULT_SETTINGS } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);

  const handleCreateRoom = async () => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float-delayed" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo / Title */}
        <div className="text-center mb-12">
          <h1 className="text-7xl sm:text-8xl font-bold tracking-tight mb-4">
            Pikoo
          </h1>
          <p className="text-white/50 text-lg sm:text-xl max-w-md mx-auto">
            A shared Pomodoro timer for remote collaboration. Focus together, anywhere.
          </p>
        </div>

        {/* Main action card */}
        <div className="w-full max-w-md">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            {/* Settings toggle */}
            {showSettings ? (
              <div className="space-y-6 mb-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Focus duration */}
                <div>
                  <label className="block text-sm text-white/60 mb-2">Focus Duration</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={settings.focusSec / 60}
                      onChange={(e) => setSettings({ ...settings, focusSec: Number(e.target.value) * 60 })}
                      className="flex-1 accent-rose-500"
                    />
                    <span className="w-16 text-right font-mono">{settings.focusSec / 60}m</span>
                  </div>
                </div>

                {/* Break duration */}
                <div>
                  <label className="block text-sm text-white/60 mb-2">Break Duration</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={settings.breakSec / 60}
                      onChange={(e) => setSettings({ ...settings, breakSec: Number(e.target.value) * 60 })}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="w-16 text-right font-mono">{settings.breakSec / 60}m</span>
                  </div>
                </div>

                {/* Long break duration */}
                <div>
                  <label className="block text-sm text-white/60 mb-2">Long Break Duration</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="5"
                      max="45"
                      value={settings.longBreakSec / 60}
                      onChange={(e) => setSettings({ ...settings, longBreakSec: Number(e.target.value) * 60 })}
                      className="flex-1 accent-blue-500"
                    />
                    <span className="w-16 text-right font-mono">{settings.longBreakSec / 60}m</span>
                  </div>
                </div>

                {/* Long break interval */}
                <div>
                  <label className="block text-sm text-white/60 mb-2">Long Break After</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="2"
                      max="8"
                      value={settings.longBreakEvery}
                      onChange={(e) => setSettings({ ...settings, longBreakEvery: Number(e.target.value) })}
                      className="flex-1 accent-purple-500"
                    />
                    <span className="w-16 text-right font-mono">{settings.longBreakEvery} cycles</span>
                  </div>
                </div>

                {/* Mode selection */}
                <div>
                  <label className="block text-sm text-white/60 mb-3">Control Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSettings({ ...settings, mode: "collab" })}
                      className={`
                        p-3 rounded-xl border transition-all text-sm
                        ${settings.mode === "collab"
                          ? "border-purple-500 bg-purple-500/20 text-white"
                          : "border-white/10 text-white/60 hover:border-white/20"
                        }
                      `}
                    >
                      <div className="font-medium mb-1">Collaborative</div>
                      <div className="text-xs opacity-70">Anyone can control</div>
                    </button>
                    <button
                      onClick={() => setSettings({ ...settings, mode: "host" })}
                      className={`
                        p-3 rounded-xl border transition-all text-sm
                        ${settings.mode === "host"
                          ? "border-purple-500 bg-purple-500/20 text-white"
                          : "border-white/10 text-white/60 hover:border-white/20"
                        }
                      `}
                    >
                      <div className="font-medium mb-1">Host Only</div>
                      <div className="text-xs opacity-70">Only you control</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-white/50 text-sm mb-6">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  No sign-up required
                </div>
                <h2 className="text-2xl font-medium mb-2">Start a Timer</h2>
                <p className="text-white/50">
                  Create a room and share the link with your team
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className={`
                  w-full py-4 px-6 rounded-2xl font-medium text-lg
                  bg-gradient-to-r from-rose-500 to-pink-500 
                  hover:from-rose-400 hover:to-pink-400
                  active:from-rose-600 active:to-pink-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-lg shadow-rose-500/25
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
                  "Create Room"
                )}
              </button>

              {!showSettings && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full py-3 px-6 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  Customize Settings
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
