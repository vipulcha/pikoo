"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  SOUND_OPTIONS, 
  SoundId, 
  startNoise, 
  stopNoise, 
  setNoiseVolume,
  getSoundFileUrl 
} from "@/lib/audio";
import { LOFI_STATIONS } from "@/lib/lofiStations";
import { trace } from "@/lib/trace";

const STORAGE_KEY_SOUND = "pikoo_sound";
const STORAGE_KEY_VOLUME = "pikoo_volume";
const STORAGE_KEY_HINT = "pikoo:music-hint-seen";

export function AudioPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSound, setCurrentSound] = useState<SoundId>("off");
  const [volume, setVolume] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [station, setStation] = useState<string | null>(null); // live lo-fi radio id
  const [showHint, setShowHint] = useState(false);
  const [hintPos, setHintPos] = useState<{ top: number; right: number } | null>(null);
  const ytRef = useRef<HTMLIFrameElement | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved preferences on mount
  useEffect(() => {
    setIsMounted(true);
    const savedSound = localStorage.getItem(STORAGE_KEY_SOUND) as SoundId | null;
    const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
    
    if (savedVolume) {
      setVolume(parseFloat(savedVolume));
    }
    // Don't auto-play on mount, just restore the selection
    if (savedSound) {
      setCurrentSound(savedSound);
    }
  }, []);

  // One-time nudge so people notice the music button
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(STORAGE_KEY_HINT) === "1"; } catch { /* storage blocked */ }
    if (seen) return;
    const t = setTimeout(() => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      setHintPos({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) });
      setShowHint(true);
    }, 6000);
    return () => clearTimeout(t);
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem(STORAGE_KEY_HINT, "1"); } catch { /* storage blocked */ }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is outside both button and dropdown
      const clickedButton = buttonRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      
      // Only close if click is outside both button and dropdown
      if (!clickedButton && !clickedDropdown) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      // Use a small delay to ensure portal is mounted and ref is set
      const timeout = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      
      return () => {
        clearTimeout(timeout);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Stop all audio
  const stopAllAudio = useCallback(() => {
    stopNoise();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  // Play sound
  const playSound = useCallback(async (soundId: SoundId) => {
    stopAllAudio();
    setStation(null);
    
    if (soundId === "off") {
      setCurrentSound("off");
      localStorage.setItem(STORAGE_KEY_SOUND, "off");
      return;
    }

    const option = SOUND_OPTIONS.find(o => o.id === soundId);
    if (!option) return;

    setCurrentSound(soundId);
    localStorage.setItem(STORAGE_KEY_SOUND, soundId);

    if (option.type === "noise") {
      // Generated noise
      startNoise(soundId as "white" | "brown" | "pink", volume);
    } else if (option.type === "file") {
      // File-based audio (lazy loaded)
      setIsLoading(true);
      try {
        const audio = new Audio(getSoundFileUrl(soundId));
        audio.loop = true;
        audio.volume = volume;
        
        // Wait for enough data to play
        await new Promise<void>((resolve, reject) => {
          audio.oncanplaythrough = () => resolve();
          audio.onerror = () => reject(new Error("Failed to load audio"));
          audio.load();
        });
        
        await audio.play();
        audioRef.current = audio;
      } catch (err) {
        console.error("Failed to play audio:", err);
        setCurrentSound("off");
      } finally {
        setIsLoading(false);
      }
    }
  }, [volume, stopAllAudio]);

  // Update volume
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem(STORAGE_KEY_VOLUME, newVolume.toString());
    
    // Update current audio volume
    setNoiseVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    ytCommand(ytRef.current, "setVolume", [Math.round(newVolume * 100)]);
  }, []);

  const playStation = useCallback((id: string) => {
    stopAllAudio();
    setCurrentSound("off");
    localStorage.setItem(STORAGE_KEY_SOUND, "off");
    setStation((cur) => {
      trace("music", { pick: cur === id ? "off" : `radio:${id}` });
      return cur === id ? null : id;
    });
  }, [stopAllAudio]);

  // Handle sound selection
  const handleSelectSound = (soundId: SoundId) => {
    trace("music", { pick: soundId === currentSound ? "off" : soundId });
    if (soundId === currentSound) {
      // Toggle off if same sound selected
      playSound("off");
    } else {
      playSound(soundId);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const currentOption = SOUND_OPTIONS.find(o => o.id === currentSound);
  const currentStation = LOFI_STATIONS.find((st) => st.id === station) ?? null;
  const isPlaying = currentSound !== "off" || currentStation !== null;

  if (!isMounted) return null;

  return (
    <>
      <div className="relative" ref={buttonRef}>
        {/* Toggle Button */}
        <button
          onClick={() => { if (!isOpen) trace("click", { what: "music_button" }); setIsOpen(!isOpen); dismissHint(); }}
          className={`
            h-9 px-3 sm:px-4 rounded-full transition-all duration-200 relative flex items-center gap-2
            text-sm font-medium
            ${isOpen || isPlaying
              ? "bg-white/20 text-white" 
              : "bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10"
            }
          `}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5A2.25 2.25 0 0016.5 2.25H6A2.25 2.25 0 003.75 4.5v15A2.25 2.25 0 006 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.954" />
              </svg>
              <span className="hidden sm:inline">Music</span>
              {isPlaying && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              )}
            </>
          )}
        </button>
      </div>

      {/* Dropdown - Rendered via portal to document.body to ensure it's above chat */}
      {isOpen && isMounted && typeof document !== "undefined" && createPortal(
        <div 
          ref={dropdownRef} 
          onClick={(e) => e.stopPropagation()}
          className="fixed top-20 right-4 sm:right-6 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-3 animate-fade-in" 
          style={{ zIndex: 100 }}
        >
          <p className="text-xs text-white/50 uppercase tracking-wider mb-2 px-1 flex items-center gap-2">
            Live lo-fi radio <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          </p>
          <div className="space-y-1 mb-4">
            {LOFI_STATIONS.map((st) => (
              <button
                key={st.id}
                onClick={(e) => { e.stopPropagation(); playStation(st.id); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${station === st.id ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
              >
                <span className="text-lg">{st.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm truncate">{st.label}</span>
                  <span className="block text-[11px] text-white/40 truncate">{st.by}</span>
                </span>
                {station === st.id && <span className="ml-auto text-[10px] font-semibold text-red-400">LIVE</span>}
              </button>
            ))}
          </div>

          <p className="text-xs text-white/50 uppercase tracking-wider mb-2 px-1">Ambient Sounds</p>
          
          {/* Sound Options */}
          <div className="space-y-1 mb-4">
            {SOUND_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSound(option.id);
                }}
                disabled={isLoading}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
                  ${currentSound === option.id 
                    ? "bg-white/20 text-white" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                  ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <span className="text-lg">{option.icon}</span>
                <span className="text-sm">{option.label}</span>
                {currentSound === option.id && option.id !== "off" && (
                  <span className="ml-auto">
                    <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Volume Slider */}
          <div className="px-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Volume</span>
              <span className="text-xs text-white/70 font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Current Playing */}
          {isPlaying && (currentOption || currentStation) && (
            <div className="mt-3 pt-3 border-t border-white/10 px-1">
              <p className="text-xs text-white/40">
                Now playing: <span className="text-white/70">{currentStation ? `${currentStation.icon} ${currentStation.label}` : `${currentOption?.icon} ${currentOption?.label}`}</span>
              </p>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Live radio: YouTube's player, kept visible as its embed terms require */}
      {currentStation && createPortal(
        <div className="fixed bottom-16 right-4 w-[220px] rounded-xl overflow-hidden bg-black/85 backdrop-blur-xl border border-white/15 shadow-2xl" style={{ zIndex: 90 }}>
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-white/80">
            <span className="truncate">{currentStation.icon} {currentStation.label}</span>
            <button onClick={() => setStation(null)} aria-label="Stop radio" className="text-white/50 hover:text-white">✕</button>
          </div>
          <iframe
            ref={ytRef}
            key={currentStation.id}
            src={`https://www.youtube.com/embed/${currentStation.videoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`}
            title={`${currentStation.label} by ${currentStation.by}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            onLoad={() => ytCommand(ytRef.current, "setVolume", [Math.round(volume * 100)])}
            className="block w-[220px] h-[200px] border-0"
          />
        </div>,
        document.body
      )}

      {showHint && hintPos && !isOpen && createPortal(
        <div className="fixed w-60 rounded-xl bg-violet-600 text-white shadow-2xl p-3 animate-fade-in" style={{ top: hintPos.top, right: hintPos.right, zIndex: 95 }}>
          <span className="absolute -top-1.5 right-6 w-3 h-3 rotate-45 bg-violet-600" />
          <p className="text-sm font-medium">🎧 Focus with music</p>
          <p className="text-xs text-white/80 mt-0.5">Live lo-fi radio, rain, café and noise. One click, no sign-up.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => { trace("hint", { action: "pick_a_sound" }); setIsOpen(true); dismissHint(); }} className="h-8 px-3 rounded-full bg-white text-violet-700 text-xs font-semibold">Pick a sound</button>
            <button onClick={() => { trace("hint", { action: "not_now" }); dismissHint(); }} className="h-8 px-3 rounded-full text-xs text-white/80 hover:text-white">Not now</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function ytCommand(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube.com");
}

