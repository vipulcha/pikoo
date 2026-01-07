"use client";

import { use, useState, useEffect } from "react";
import { useTimer } from "@/lib/hooks/useTimer";
import { Timer } from "@/components/Timer";
import { Controls } from "@/components/Controls";
import { ParticipantCount } from "@/components/ParticipantCount";
import { ShareButton } from "@/components/ShareButton";
import { RoomSettings } from "@/lib/types";
import Link from "next/link";

// Realistic planet/space images from Unsplash
const PLANET_IMAGES = [
  "https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=1920&q=80", // Earth from space
  "https://images.unsplash.com/photo-1630839437035-dac17da580d0?w=1920&q=80", // Mars surface
  "https://images.unsplash.com/photo-1639921884918-8d28ab2e39a4?w=1920&q=80", // Jupiter
  "https://images.unsplash.com/photo-1545156521-77bd85671d30?w=1920&q=80", // Saturn
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80", // Earth horizon
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80", // Earth night lights
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80", // Nebula
  "https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=1920&q=80", // Galaxy
];

// Pre-generate deterministic star positions (no randomness during render)
const STARS = [...Array(60)].map((_, i) => ({
  id: i,
  width: 1 + (i % 3),
  left: (i * 17) % 100,
  top: (i * 23) % 100,
  opacity: 0.3 + ((i % 7) / 10),
  delay: (i % 4),
  duration: 2 + (i % 3),
}));

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params);
  const { room, remaining, isConnected, error, actions } = useTimer(roomId);
  const [showSettings, setShowSettings] = useState(false);
  const [planetImage, setPlanetImage] = useState(PLANET_IMAGES[0]);

  // Pick random planet on client only to avoid hydration mismatch
  useEffect(() => {
    setPlanetImage(PLANET_IMAGES[Math.floor(Math.random() * PLANET_IMAGES.length)]);
  }, []);

  // Loading state
  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        {/* Stars in loading */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
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
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/60">Connecting to room...</p>
        </div>
      </div>
    );
  }

  const { timer, settings, participants } = room;

  const handleSettingChange = (key: keyof RoomSettings, value: number) => {
    actions.updateSettings({ [key]: value });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Space background with planet */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Planet image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50 scale-110"
          style={{ 
            backgroundImage: `url(${planetImage})`,
            filter: 'blur(1px)',
          }}
        />
        
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
        
        {/* Star field */}
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

      {/* Header */}
      <header className="flex items-center justify-between p-4 sm:p-6 relative z-20">
        <Link 
          href="/"
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors drop-shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span className="font-bold text-lg">Pikoo</span>
        </Link>

        <div className="flex items-center gap-3">
          <ParticipantCount count={participants.length} isConnected={isConnected} />
          <ShareButton roomId={roomId} />
          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`
              p-2 rounded-full transition-all duration-200
              ${showSettings 
                ? "bg-white/20 text-white" 
                : "bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
              }
            `}
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-500/90 text-white rounded-lg shadow-lg animate-fade-in">
          {error}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-20 right-4 sm:right-6 z-40 w-80 animate-fade-in">
          <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-medium text-white">Timer Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              {/* Focus duration */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Focus</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={settings.focusSec / 60}
                    onChange={(e) => handleSettingChange("focusSec", Number(e.target.value) * 60)}
                    className="flex-1 accent-rose-500"
                  />
                  <span className="w-12 text-right font-mono text-sm">{settings.focusSec / 60}m</span>
                </div>
              </div>

              {/* Break duration */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Break</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={settings.breakSec / 60}
                    onChange={(e) => handleSettingChange("breakSec", Number(e.target.value) * 60)}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-12 text-right font-mono text-sm">{settings.breakSec / 60}m</span>
                </div>
              </div>

              {/* Long break duration */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Long Break</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="45"
                    value={settings.longBreakSec / 60}
                    onChange={(e) => handleSettingChange("longBreakSec", Number(e.target.value) * 60)}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="w-12 text-right font-mono text-sm">{settings.longBreakSec / 60}m</span>
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
                    onChange={(e) => handleSettingChange("longBreakEvery", Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="w-12 text-right font-mono text-sm">{settings.longBreakEvery}x</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-white/40 text-center">
              Changes sync to all participants
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16 relative z-10">
        <div className="drop-shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <Timer
            remaining={remaining}
            phase={timer.phase}
            running={timer.running}
            cycleCount={timer.cycleCount}
          />
        </div>

        <div className="mt-12">
          <Controls
            running={timer.running}
            phase={timer.phase}
            onStart={actions.start}
            onPause={actions.pause}
            onReset={actions.reset}
            onSkip={actions.skip}
          />
        </div>
      </main>
    </div>
  );
}
