"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { RoomSettings, DEFAULT_SETTINGS } from "@/lib/types";
import { NamePrompt, getSavedName } from "@/components/NamePrompt";

// Pre-generate deterministic star positions to avoid hydration mismatch
const STARS = [...Array(50)].map((_, i) => ({
  id: i,
  width: 1 + (i % 3),
  left: (i * 17) % 100,
  top: (i * 23) % 100,
  opacity: 0.3 + ((i % 7) / 10),
  delay: (i % 4),
  duration: 2 + (i % 3),
}));

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);

  const handleCreateRoom = async () => {
    // Check if user has a name saved
    const savedName = getSavedName();
    if (!savedName) {
      setShowNamePrompt(true);
      return;
    }
    
    proceedToCreateRoom();
  };

  const handleNameSubmit = (name: string) => {
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
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Space background with stars */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Subtle space gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950/50 to-black" />
        
        {/* Star field */}
        <div className="absolute inset-0">
          {STARS.map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white animate-twinkle"
              style={{
                width: `${star.width}px`,
                height: `${star.width}px`,
                left: `${star.left}%`,
                top: `${star.top}%`,
                opacity: star.opacity,
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
              }}
            />
          ))}
        </div>

        {/* Solar system */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Sun glow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-amber-500/80 rounded-full blur-md animate-sun-pulse" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-amber-500/30 rounded-full blur-xl" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
          
          {/* Orbit 1 - Mercury */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-1">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-400 rounded-full shadow-lg shadow-gray-400/50" />
            </div>
          </div>
          
          {/* Orbit 2 - Venus */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-2">
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-200 rounded-full shadow-lg shadow-amber-200/50" />
            </div>
          </div>
          
          {/* Orbit 3 - Earth */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-3">
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-full shadow-lg shadow-blue-400/50" />
            </div>
          </div>
          
          {/* Orbit 4 - Mars */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-4">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-rose-500 rounded-full shadow-lg shadow-rose-500/50" />
            </div>
          </div>
          
          {/* Orbit 5 - Jupiter */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-gradient-to-br from-amber-600 to-orange-300 rounded-full shadow-lg shadow-amber-500/30" />
            </div>
          </div>
          
          {/* Orbit 6 - Saturn with ring */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-6">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <div className="relative w-5 h-5 bg-gradient-to-br from-amber-200 to-amber-400 rounded-full shadow-lg shadow-amber-300/30" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-2 border border-amber-300/50 rounded-full -rotate-12" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Ambient glow from sun */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent rounded-full" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo / Title */}
        <div className="text-center mb-16 relative">
          <h1 className="relative text-7xl sm:text-8xl font-bold tracking-tight mb-6 animate-shimmer opacity-0 animate-slide-up drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            Pikoo
          </h1>
          <p className="relative text-white/80 text-lg sm:text-xl max-w-md mx-auto opacity-0 animate-slide-up animation-delay-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            A shared Pomodoro timer for remote collaboration. Focus together, anywhere.
          </p>
        </div>

        {/* Main content - no card */}
        <div className="w-full max-w-md opacity-0 animate-slide-up animation-delay-400 text-center">
          {/* Settings panel - keep card for form elements */}
          {showSettings ? (
            <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
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

              <div className="space-y-6 text-left">
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
            </div>
          ) : (
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/70 text-sm mb-8 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                No sign-up required
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-4">
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className={`
                w-full py-4 px-8 rounded-full font-semibold text-lg
                bg-gradient-to-r from-rose-500 to-pink-500 
                hover:from-rose-400 hover:to-pink-400
                active:from-rose-600 active:to-pink-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 
                shadow-2xl shadow-rose-500/30 animate-glow-pulse
                hover:scale-105 active:scale-[0.98]
                hover:shadow-rose-500/50
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
                className="text-white/50 hover:text-white transition-all text-sm tracking-wide"
              >
                ⚙️ Customize Settings
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Name prompt modal */}
      <NamePrompt
        isOpen={showNamePrompt}
        onSubmit={handleNameSubmit}
        title="What's your name?"
        subtitle="This will be shown to others in the room"
      />
    </div>
  );
}
