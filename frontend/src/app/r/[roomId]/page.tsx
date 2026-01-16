"use client";

import { use, useState, useEffect, useRef } from "react";
import { useTimer } from "@/lib/hooks/useTimer";
import { Timer } from "@/components/Timer";
import { Controls } from "@/components/Controls";
import { ParticipantCount } from "@/components/ParticipantCount";
import { ShareButton } from "@/components/ShareButton";
import { NamePrompt, getSavedName, saveName, getUserId, clearSavedName } from "@/components/NamePrompt";
import { ChatPanel } from "@/components/ChatPanel";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TodoList } from "@/components/TodoList";
import { OthersTodos } from "@/components/OthersTodos";
import { SessionPrompt } from "@/components/SessionPrompt";
import { WelcomePrompt } from "@/components/WelcomePrompt";
import { HistoryPanel } from "@/components/HistoryPanel";
import { RoomSettings, Phase } from "@/lib/types";
import { notifyFocusEnd, notifyBreakEnd, requestNotificationPermission, getNotificationPermission } from "@/lib/audio";
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
  const [userName, setUserName] = useState<string | null>(null);
  const [uniqueId, setUniqueId] = useState<string>("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [planetImage, setPlanetImage] = useState(PLANET_IMAGES[0]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [pendingActiveFromWelcome, setPendingActiveFromWelcome] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const prevPhaseRef = useRef<Phase | null>(null);
  const hasAutoSkippedRef = useRef(false);
  const timerStartPhaseRef = useRef<Phase | null>(null); // Track which phase the timer was started for
  const timerStartTimeRef = useRef<number>(0); // Track when timer actually started (for this phase)
  const prevRunningRef = useRef<boolean>(false); // Track previous running state to detect timer start
  const phaseChangeTimeRef = useRef<number>(0); // Track when phase last changed
  const processedTransitionRef = useRef<string | null>(null); // Track processed transitions to avoid duplicates

  // Check for saved name and get uniqueId on mount
  useEffect(() => {
    setUniqueId(getUserId());
    const savedName = getSavedName();
    if (savedName) {
      setUserName(savedName);
    }
    // We'll show welcome prompt later, not name prompt
  }, []);

  // Pick random planet on client only to avoid hydration mismatch
  useEffect(() => {
    setPlanetImage(PLANET_IMAGES[Math.floor(Math.random() * PLANET_IMAGES.length)]);
  }, []);

  const handleNameSubmit = (name: string) => {
    setUserName(name);
    setNameError(undefined);
    setShowNamePrompt(false);
  };

  // Only connect to room after we have a name and uniqueId
  const { room, remaining, isConnected, error, nameTakenError, actions } = useTimer(
    roomId,
    userName || "",
    uniqueId
  );

  // Handle name taken error - show prompt again
  useEffect(() => {
    if (nameTakenError && error) {
      clearSavedName();
      setUserName(null);
      setNameError(error);
      setShowNamePrompt(true);
    }
  }, [nameTakenError, error]);

  // Calculate if there are unread messages
  const messages = room?.messages || [];
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const hasUnreadMessages = latestMessageId !== null && latestMessageId !== lastReadMessageId;

  // Mark messages as read when opening chat
  const handleToggleChat = () => {
    if (!isChatOpen && latestMessageId) {
      // Opening chat - mark all messages as read
      setLastReadMessageId(latestMessageId);
    }
    setIsChatOpen(!isChatOpen);
  };

  // Also mark as read when new messages arrive while chat is open
  useEffect(() => {
    if (isChatOpen && latestMessageId && latestMessageId !== lastReadMessageId) {
      setLastReadMessageId(latestMessageId);
    }
  }, [isChatOpen, latestMessageId, lastReadMessageId]);

  // Detect phase transitions - show prompt and play notification sounds
  useEffect(() => {
    if (!room?.timer) return;

    const currentPhase = room.timer.phase;
    const prevPhase = prevPhaseRef.current;

    // Create a unique transition key to prevent duplicate processing
    const transitionKey = prevPhase && currentPhase ? `${prevPhase}->${currentPhase}` : null;

    // Only trigger on actual phase changes (not initial load)
    // Also check if we've already processed this exact transition (handles out-of-order updates)
    if (prevPhase && prevPhase !== currentPhase && processedTransitionRef.current !== transitionKey) {
      // Mark this transition as processed
      processedTransitionRef.current = transitionKey || null;

      // Send notification based on what phase just ended
      if (prevPhase === "focus") {
        // Focus session ended → break time! (celebratory notification)
        notifyFocusEnd();
      } else if (prevPhase === "break" || prevPhase === "long_break") {
        // Break ended → back to focus (gentle reminder)
        notifyBreakEnd();
      }

      // Show prompt ONLY when transitioning FROM break/long_break TO focus
      // Never show when transitioning TO break or long_break
      if (currentPhase === "focus" && (prevPhase === "break" || prevPhase === "long_break")) {
        console.log(`[PHASE_TRANSITION] Showing session prompt: ${prevPhase} → ${currentPhase}`);
        setTimeout(() => {
          // Double-check we're still in focus phase before showing (defense against race conditions)
          const roomCheck = room?.timer?.phase;
          if (roomCheck === "focus") {
            setShowSessionPrompt(true);
          } else {
            console.log(`[PHASE_TRANSITION] Aborted showing prompt - phase changed to ${roomCheck}`);
          }
        }, 500);
      } else {
        // Explicitly hide prompt if transitioning to break or if we're already in break
        if (currentPhase === "break" || currentPhase === "long_break") {
          console.log(`[PHASE_TRANSITION] Hiding session prompt - transitioning to ${currentPhase}`);
          setShowSessionPrompt(false);
        }
      }
    }

    // Update prevPhaseRef at the end, but only if phase actually changed
    // This prevents duplicate processing if multiple updates arrive with same phase
    if (prevPhase !== currentPhase) {
      prevPhaseRef.current = currentPhase;
      // Clear auto-skip tracking when phase changes (timer needs to be restarted for new phase)
      hasAutoSkippedRef.current = false;
      timerStartPhaseRef.current = null;
      timerStartTimeRef.current = 0;
      prevRunningRef.current = false; // Reset running state tracking
      phaseChangeTimeRef.current = Date.now(); // Record when phase changed
      console.log(`[PHASE_CHANGE] Phase changed to ${currentPhase}`);
    }
  }, [room?.timer?.phase]);

  // Auto-transition to next phase when timer reaches 0
  // CRITICAL: Only auto-skip if timer has been running and counting down for a meaningful duration
  useEffect(() => {
    if (!room?.timer) return;

    const { running, phaseEndsAt, phase } = room.timer;
    const prevRunning = prevRunningRef.current;

    // Check if timer has reached 0
    const now = Date.now();
    const remainingMs = phaseEndsAt ? phaseEndsAt - now : Infinity;

    // Detect when timer actually starts (transitions from false to true)
    // CRITICAL: Only record if phaseEndsAt is in the future AND has meaningful duration
    // This ensures we never track timers that start at 0 or are stale
    if (!prevRunning && running && phaseEndsAt && remainingMs > 5000) {
      // Timer just started - phaseEndsAt is at least 5 seconds in the future
      timerStartPhaseRef.current = phase;
      timerStartTimeRef.current = Date.now();
      hasAutoSkippedRef.current = false;
      console.log(`[AUTO_SKIP] Timer started for phase: ${phase}, remaining: ${Math.ceil(remainingMs / 1000)}s`);
    }

    // Update prevRunningRef for next render
    prevRunningRef.current = running;

    // Only auto-skip if timer is actually running
    if (!running || !phaseEndsAt) {
      // Reset flags when timer stops
      if (running === false && prevRunning === true) {
        // Timer just stopped
        hasAutoSkippedRef.current = false;
        timerStartPhaseRef.current = null;
        timerStartTimeRef.current = 0;
      }
      return;
    }

    // CRITICAL: Only auto-skip if current phase matches the phase when timer was started
    // This prevents auto-skipping with stale phaseEndsAt from a previous phase
    if (timerStartPhaseRef.current === null) {
      // Timer is running but we haven't tracked the start phase yet
      // This means either:
      // 1. Stale data where phaseEndsAt is in the past or too close to 0
      // 2. Timer was already running when we joined (but we can't verify it's valid)
      // In either case, don't auto-skip - user must manually skip
      console.log(`[AUTO_SKIP] Timer is running but start phase not tracked - ignoring (remaining: ${Math.ceil(remainingMs / 1000)}s)`);
      return;
    }

    if (timerStartPhaseRef.current !== phase) {
      console.log(`[AUTO_SKIP] Preventing auto-skip - timer was started for phase "${timerStartPhaseRef.current}", but current phase is "${phase}" (stale data)`);
      return;
    }

    // CRITICAL: Only auto-skip if timer has been running for at least 5 seconds
    // This ensures the timer actually counted down and wasn't just started at 0
    const timeSinceTimerStart = timerStartTimeRef.current > 0 ? Date.now() - timerStartTimeRef.current : Infinity;
    const MIN_RUNTIME_MS = 5000; // Must run for at least 5 seconds

    // STRICT CHECK: Only auto-skip if remaining EXACTLY 0 (or less) AND not already skipped
    if (remainingMs <= 0 && !hasAutoSkippedRef.current) {
      if (timerStartTimeRef.current === 0) {
        console.log(`[AUTO_SKIP] Preventing auto-skip - timer start time not tracked`);
        return;
      }

      if (timeSinceTimerStart < MIN_RUNTIME_MS) {
        console.log(`[AUTO_SKIP] Preventing auto-skip - timer only ran for ${Math.ceil(timeSinceTimerStart / 1000)}s (need at least ${MIN_RUNTIME_MS / 1000}s)`);
        return;
      }

      // Double check visible remaining seconds too, just to be safe
      if (remaining > 0) {
        console.log(`[AUTO_SKIP] Preventing auto-skip - visible remaining is ${remaining}s (wait for 0)`);
        return;
      }

      console.log(`[AUTO_SKIP] Timer reached 0, auto-skipping phase ${phase} to next phase (ran for ${Math.ceil(timeSinceTimerStart / 1000)}s)`);
      hasAutoSkippedRef.current = true;
      actions.skip("auto");
    }
  }, [remaining, room?.timer?.running, room?.timer?.phaseEndsAt, room?.timer?.phase, actions]);

  // Safety: Close session prompt if we're not in focus phase
  useEffect(() => {
    if (showSessionPrompt && room?.timer?.phase !== "focus") {
      console.log(`[SAFETY] Closing session prompt - current phase is ${room?.timer?.phase}, not focus`);
      setShowSessionPrompt(false);
    }
  }, [showSessionPrompt, room?.timer?.phase]);

  // Show welcome prompt for new users (no name) immediately, or users with no todos after room loads
  useEffect(() => {
    if (hasShownWelcome || !uniqueId) return;

    const savedName = getSavedName();

    // If no saved name, show welcome prompt immediately
    if (!savedName) {
      setShowWelcomePrompt(true);
      setHasShownWelcome(true);
      return;
    }

    // If we have a name but no todos, show after room loads
    if (room) {
      const myTodos = room.userTodos?.[uniqueId];
      const hasTodos = myTodos && myTodos.todos.length > 0;

      if (!hasTodos) {
        const timer = setTimeout(() => {
          setShowWelcomePrompt(true);
          setHasShownWelcome(true);
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [room, uniqueId, hasShownWelcome]);

  // Auto-set the first todo as active when added from welcome prompt
  // Wait for the REAL ID from server (not temp_xxx) to avoid race condition
  useEffect(() => {
    if (!pendingActiveFromWelcome || !room) return;

    const myTodos = room.userTodos?.[uniqueId];
    if (myTodos && myTodos.todos.length > 0) {
      const firstTodo = myTodos.todos[0];
      // Only set active if it's a real ID from server (not temp from optimistic update)
      // This prevents race condition between TODO_ADD and TODO_SET_ACTIVE
      if (!firstTodo.id.startsWith('temp_')) {
        actions.setActiveTodo(firstTodo.id);
        setPendingActiveFromWelcome(false);
      }
    }
  }, [room?.userTodos, uniqueId, pendingActiveFromWelcome, actions]);

  // Update browser tab title with timer countdown
  useEffect(() => {
    const originalTitle = "Pikoo - Shared Team Timer";

    // If no room/timer yet, don't update title
    if (!room?.timer) {
      return;
    }

    const { timer } = room;

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getPhaseLabel = (phase: Phase) => {
      switch (phase) {
        case "focus": return "Focus";
        case "break": return "Break";
        case "long_break": return "Break";
        default: return "";
      }
    };

    const updateTitle = () => {
      let remainingSec: number;

      if (timer.running && timer.phaseEndsAt) {
        remainingSec = Math.max(0, Math.ceil((timer.phaseEndsAt - Date.now()) / 1000));
      } else {
        remainingSec = timer.remainingSecWhenPaused;
      }

      const timeStr = formatTime(remainingSec);
      const phaseLabel = getPhaseLabel(timer.phase);
      document.title = `${timeStr} ${phaseLabel} - Pikoo`;
    };

    // Update immediately
    updateTitle();

    // If running, set up interval to update every second
    let intervalId: NodeJS.Timeout | null = null;
    if (timer.running) {
      intervalId = setInterval(updateTitle, 1000);
    }

    // Cleanup: clear interval and restore original title
    return () => {
      if (intervalId) clearInterval(intervalId);
      document.title = originalTitle;
    };
  }, [room?.timer?.running, room?.timer?.phase, room?.timer?.phaseEndsAt, room?.timer?.remainingSecWhenPaused]);

  // Show name prompt only for errors (name taken) - otherwise WelcomePrompt handles it
  if (showNamePrompt && nameError) {
    return (
      <div className="min-h-screen bg-black">
        {/* Stars background */}
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
        <NamePrompt
          isOpen={true}
          onSubmit={handleNameSubmit}
          title="Choose a different name"
          subtitle="That name is already taken in this room"
          errorMessage={nameError}
        />
      </div>
    );
  }

  // Loading state (connecting to room) - but show welcome prompt if no name
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

        {/* Welcome Prompt for new users (shown during loading) */}
        <WelcomePrompt
          isVisible={showWelcomePrompt}
          initialName={userName || ""}
          onAddTodo={(text) => {
            // Add todo directly - no reconnection happens now!
            actions.addTodo(text);
            setPendingActiveFromWelcome(true);
          }}
          onDismiss={(name) => {
            // Save the name - UPDATE_NAME event will be sent (no reconnection)
            saveName(name);
            setUserName(name);
            setShowWelcomePrompt(false);
          }}
        />
      </div>
    );
  }

  const { timer, settings, participants, userTodos } = room;

  // Get current user's todos
  const myTodos = userTodos?.[uniqueId] || null;

  const handleSettingChange = (key: keyof RoomSettings, value: number) => {
    actions.updateSettings({ [key]: value });
  };

  // Request notification permissions when starting the timer
  const handleStart = async () => {
    const permission = getNotificationPermission();

    // If permission hasn't been decided yet, show explanation first
    if (permission === "default") {
      setShowNotificationPrompt(true);
      return;
    }

    // Permission already granted or denied, just start
    actions.start();
  };

  // Handle notification permission after user sees explanation
  const handleNotificationResponse = async (allow: boolean) => {
    setShowNotificationPrompt(false);

    if (allow) {
      await requestNotificationPermission();
    }

    // Start the timer regardless of their choice
    actions.start();
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
          <ParticipantCount participants={participants} isConnected={isConnected} />
          <ShareButton roomId={roomId} />
          <AudioPlayer />
          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`
              px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5
              text-sm font-medium
              ${showSettings
                ? "bg-white/20 text-white"
                : "bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Timer</span>
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
                    min="1"
                    max="60"
                    value={settings.focusSec / 60}
                    onChange={(e) => handleSettingChange("focusSec", Number(e.target.value) * 60)}
                    className="flex-1 accent-rose-500"
                  />
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={settings.focusSec / 60}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(120, Number(e.target.value) || 1));
                      handleSettingChange("focusSec", val * 60);
                    }}
                    className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-center font-mono text-sm focus:outline-none focus:border-rose-500/50 no-spinner"
                  />
                  <span className="text-white/60 text-sm">m</span>
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
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={settings.breakSec / 60}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(120, Number(e.target.value) || 1));
                      handleSettingChange("breakSec", val * 60);
                    }}
                    className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-center font-mono text-sm focus:outline-none focus:border-emerald-500/50 no-spinner"
                  />
                  <span className="text-white/60 text-sm">m</span>
                </div>
              </div>

              {/* Long break duration */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Long Break</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="45"
                    value={settings.longBreakSec / 60}
                    onChange={(e) => handleSettingChange("longBreakSec", Number(e.target.value) * 60)}
                    className="flex-1 accent-blue-500"
                  />
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={settings.longBreakSec / 60}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(120, Number(e.target.value) || 1));
                      handleSettingChange("longBreakSec", val * 60);
                    }}
                    className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-center font-mono text-sm focus:outline-none focus:border-blue-500/50 no-spinner"
                  />
                  <span className="text-white/60 text-sm">m</span>
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
                  <input
                    type="number"
                    min="2"
                    max="8"
                    value={settings.longBreakEvery}
                    onChange={(e) => {
                      const val = Math.max(2, Math.min(8, Number(e.target.value) || 2));
                      handleSettingChange("longBreakEvery", val);
                    }}
                    className="w-14 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-center font-mono text-sm focus:outline-none focus:border-purple-500/50"
                  />
                  <span className="text-white/60 text-sm">x</span>
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
      <main className="flex-1 flex items-center justify-center px-4 -mt-16 relative z-10">
        {/* Todo List - Left side */}
        <div className="absolute left-2 sm:left-4 lg:left-8 top-1/2 -translate-y-1/2 hidden md:block">
          <div className="flex flex-col gap-2">
            {/* History Panel - Above Todo List */}
            <HistoryPanel history={room?.history || []} />

            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
              <TodoList
                userTodos={myTodos}
                onAddTodo={actions.addTodo}
                onUpdateTodo={actions.updateTodo}
                onDeleteTodo={actions.deleteTodo}
                onReorderTodos={actions.reorderTodos}
                onSetActiveTodo={actions.setActiveTodo}
                onSetVisibility={actions.setTodoVisibility}
              />
            </div>
          </div>
        </div>

        {/* Center - Timer and Controls */}
        <div className="flex flex-col items-center">
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
              onStart={handleStart}
              onPause={actions.pause}
              onReset={actions.reset}
              onSkip={() => actions.skip("manual")}
            />
          </div>


          {/* Mobile Todo Toggle - shows todo panel for mobile */}
          <div className="mt-8 md:hidden">
            <MobileTodoPanel
              userTodos={myTodos}
              history={room?.history || []}
              onAddTodo={actions.addTodo}
              onUpdateTodo={actions.updateTodo}
              onDeleteTodo={actions.deleteTodo}
              onReorderTodos={actions.reorderTodos}
              onSetActiveTodo={actions.setActiveTodo}
              onSetVisibility={actions.setTodoVisibility}
            />
          </div>
        </div>
      </main>

      {/* Chat Panel */}
      <ChatPanel
        messages={messages}
        onSendMessage={actions.sendMessage}
        isOpen={isChatOpen}
        onToggle={handleToggleChat}
        hasUnread={hasUnreadMessages}
      />

      {/* Others' Todos Panel */}
      <OthersTodos
        userTodos={userTodos || {}}
        currentUserId={uniqueId}
        participants={participants}
      />

      {/* Session Start Prompt - Only show for focus phase */}
      <SessionPrompt
        isVisible={showSessionPrompt && room?.timer?.phase === "focus"}
        userTodos={myTodos}
        onSelectTodo={(todoId) => {
          if (todoId) actions.setActiveTodo(todoId);
        }}
        onDismiss={() => setShowSessionPrompt(false)}
      />

      {/* Welcome Prompt for first-time users */}
      <WelcomePrompt
        isVisible={showWelcomePrompt}
        initialName={userName || ""}
        onAddTodo={(text) => {
          // Add todo directly - no reconnection happens now!
          actions.addTodo(text);
          setPendingActiveFromWelcome(true);
        }}
        onDismiss={(name) => {
          // Save the name - UPDATE_NAME event will be sent (no reconnection)
          saveName(name);
          setUserName(name);
          setShowWelcomePrompt(false);
        }}
      />

      {/* Notification Permission Prompt */}
      {showNotificationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => handleNotificationResponse(false)}
          />
          <div className="relative bg-slate-900/95 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center">
              {/* Bell Icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>

              <h3 className="text-xl font-semibold text-white mb-2">
                Stay in the loop! 🔔
              </h3>

              <p className="text-white/70 text-sm mb-6">
                Enable notifications to get alerted when your <span className="text-rose-400 font-medium">focus session</span> or <span className="text-emerald-400 font-medium">break</span> ends — even if you&apos;re in another tab.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleNotificationResponse(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors"
                >
                  Maybe later
                </button>
                <button
                  onClick={() => handleNotificationResponse(true)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-medium transition-all shadow-lg shadow-amber-500/25"
                >
                  Enable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile Todo Panel Component
function MobileTodoPanel({
  userTodos,
  history,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onReorderTodos,
  onSetActiveTodo,
  onSetVisibility,
}: {
  userTodos: import("@/lib/types").UserTodos | null;
  history: import("@/lib/types").ActivityLog[];
  onAddTodo: (text: string) => void;
  onUpdateTodo: (todoId: string, updates: { text?: string; completed?: boolean }) => void;
  onDeleteTodo: (todoId: string) => void;
  onReorderTodos: (todoIds: string[]) => void;
  onSetActiveTodo: (todoId: string | null) => void;
  onSetVisibility: (isPublic: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const todos = userTodos?.todos || [];
  const completedCount = todos.filter(t => t.completed).length;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-xl
          backdrop-blur-xl border transition-all duration-300
          ${isOpen
            ? "bg-white/15 border-white/20 text-white"
            : "bg-black/40 border-white/10 text-white/70 hover:text-white"
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
        <span className="text-sm font-medium">My Tasks</span>
        <span className="px-1.5 py-0.5 bg-white/10 rounded-full text-xs">
          {completedCount}/{todos.length}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-md bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white">My Tasks</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <HistoryPanel history={history} />
            </div>
            <TodoList
              userTodos={userTodos}
              onAddTodo={onAddTodo}
              onUpdateTodo={onUpdateTodo}
              onDeleteTodo={onDeleteTodo}
              onReorderTodos={onReorderTodos}
              onSetActiveTodo={onSetActiveTodo}
              onSetVisibility={onSetVisibility}
            />
          </div>
        </div>
      )}
    </>
  );
}


