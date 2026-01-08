"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
  SOUND_OPTIONS, 
  SoundId, 
  startNoise, 
  stopNoise, 
  setNoiseVolume,
  getSoundFileUrl 
} from "@/lib/audio";

const STORAGE_KEY_SOUND = "pikoo_sound";
const STORAGE_KEY_VOLUME = "pikoo_volume";

export function AudioPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSound, setCurrentSound] = useState<SoundId>("off");
  const [volume, setVolume] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
  }, []);

  // Handle sound selection
  const handleSelectSound = (soundId: SoundId) => {
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
  const isPlaying = currentSound !== "off";

  if (!isMounted) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          px-3 py-1.5 rounded-full transition-all duration-200 relative flex items-center gap-1.5
          text-sm font-medium
          ${isOpen || isPlaying
            ? "bg-white/20 text-white" 
            : "bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
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
            <span>Music</span>
            {isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
            )}
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-3 animate-fade-in z-50">
          <p className="text-xs text-white/50 uppercase tracking-wider mb-2 px-1">Ambient Sounds</p>
          
          {/* Sound Options */}
          <div className="space-y-1 mb-4">
            {SOUND_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelectSound(option.id)}
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
          {isPlaying && currentOption && (
            <div className="mt-3 pt-3 border-t border-white/10 px-1">
              <p className="text-xs text-white/40">
                Now playing: <span className="text-white/70">{currentOption.icon} {currentOption.label}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

