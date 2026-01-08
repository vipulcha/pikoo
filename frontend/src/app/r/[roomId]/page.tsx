"use client";

import { use, useState, useEffect, useRef } from "react";
import { useTimer } from "@/lib/hooks/useTimer";
import { Timer } from "@/components/Timer";
import { Controls } from "@/components/Controls";
import { ParticipantCount } from "@/components/ParticipantCount";
import { ShareButton } from "@/components/ShareButton";
import { NamePrompt, getSavedName, getUserId, clearSavedName } from "@/components/NamePrompt";
import { ChatPanel } from "@/components/ChatPanel";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TodoList } from "@/components/TodoList";
import { OthersTodos } from "@/components/OthersTodos";
import { SessionPrompt } from "@/components/SessionPrompt";
import { WelcomePrompt } from "@/components/WelcomePrompt";
import { RoomSettings, Phase } from "@/lib/types";
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
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageCountRef = useRef(0);
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [pendingActiveFromWelcome, setPendingActiveFromWelcome] = useState(false);
  const prevPhaseRef = useRef<Phase | null>(null);

  // Check for saved name and get uniqueId on mount
  useEffect(() => {
    setUniqueId(getUserId());
    const savedName = getSavedName();
    if (savedName) {
      setUserName(savedName);
    } else {
      setShowNamePrompt(true);
    }
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

  // Track unread messages when chat is closed (must be before early returns)
  const messages = room?.messages;
  useEffect(() => {
    const currentCount = messages?.length || 0;
    if (!isChatOpen && currentCount > lastMessageCountRef.current) {
      setUnreadCount(prev => prev + (currentCount - lastMessageCountRef.current));
    }
    lastMessageCountRef.current = currentCount;
  }, [messages?.length, isChatOpen]);

  // Clear unread when opening chat
  const handleToggleChat = () => {
    if (!isChatOpen) {
      setUnreadCount(0);
    }
    setIsChatOpen(!isChatOpen);
  };

  // Detect new focus session and show prompt
  useEffect(() => {
    if (!room?.timer) return;
    
    const currentPhase = room.timer.phase;
    const prevPhase = prevPhaseRef.current;
    
    // Show prompt when transitioning TO focus phase (from break or long_break)
    if (currentPhase === "focus" && prevPhase && prevPhase !== "focus") {
      // Small delay to let the phase change feel natural
      setTimeout(() => setShowSessionPrompt(true), 500);
    }
    
    prevPhaseRef.current = currentPhase;
  }, [room?.timer?.phase]);

  // Show welcome prompt for first-time users with no todos
  useEffect(() => {
    if (!room || hasShownWelcome) return;
    
    const myTodos = room.userTodos?.[uniqueId];
    const hasTodos = myTodos && myTodos.todos.length > 0;
    
    // If user has no todos, show welcome prompt after a short delay
    if (!hasTodos && uniqueId) {
      const timer = setTimeout(() => {
        setShowWelcomePrompt(true);
        setHasShownWelcome(true);
      }, 1000); // Wait 1 second after room loads
      
      return () => clearTimeout(timer);
    }
  }, [room, uniqueId, hasShownWelcome]);

  // Auto-set the first todo as active when added from welcome prompt
  useEffect(() => {
    if (!pendingActiveFromWelcome || !room) return;
    
    const myTodos = room.userTodos?.[uniqueId];
    if (myTodos && myTodos.todos.length > 0) {
      // Set the first (and likely only) todo as active
      const firstTodo = myTodos.todos[0];
      actions.setActiveTodo(firstTodo.id);
      setPendingActiveFromWelcome(false);
    }
  }, [room?.userTodos, uniqueId, pendingActiveFromWelcome, actions]);

  // Show name prompt if needed
  if (showNamePrompt || !userName) {
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
          title="Join Room"
          subtitle="Enter your name to join this focus session"
          errorMessage={nameError}
        />
      </div>
    );
  }

  // Loading state (connecting to room)
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

  const { timer, settings, participants, userTodos } = room;
  
  // Get current user's todos
  const myTodos = userTodos?.[uniqueId] || null;

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
      <main className="flex-1 flex items-center justify-center px-4 -mt-16 relative z-10">
        {/* Todo List - Left side */}
        <div className="absolute left-2 sm:left-4 lg:left-8 top-1/2 -translate-y-1/2 hidden md:block">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
            <TodoList
              userTodos={myTodos}
              onAddTodo={actions.addTodo}
              onUpdateTodo={actions.updateTodo}
              onDeleteTodo={actions.deleteTodo}
              onSetActiveTodo={actions.setActiveTodo}
              onSetVisibility={actions.setTodoVisibility}
            />
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
              onStart={actions.start}
              onPause={actions.pause}
              onReset={actions.reset}
              onSkip={actions.skip}
            />
          </div>

          {/* Mobile Todo Toggle - shows todo panel for mobile */}
          <div className="mt-8 md:hidden">
            <MobileTodoPanel
              userTodos={myTodos}
              onAddTodo={actions.addTodo}
              onUpdateTodo={actions.updateTodo}
              onDeleteTodo={actions.deleteTodo}
              onSetActiveTodo={actions.setActiveTodo}
              onSetVisibility={actions.setTodoVisibility}
            />
          </div>
        </div>
      </main>

      {/* Chat Panel */}
      <ChatPanel
        messages={messages || []}
        onSendMessage={actions.sendMessage}
        isOpen={isChatOpen}
        onToggle={handleToggleChat}
        unreadCount={unreadCount}
      />

      {/* Others' Todos Panel */}
      <OthersTodos
        userTodos={userTodos || {}}
        currentUserId={uniqueId}
        participants={participants}
      />

      {/* Session Start Prompt */}
      <SessionPrompt
        isVisible={showSessionPrompt}
        userTodos={myTodos}
        onSelectTodo={(todoId) => {
          if (todoId) actions.setActiveTodo(todoId);
        }}
        onDismiss={() => setShowSessionPrompt(false)}
      />

      {/* Welcome Prompt for first-time users */}
      <WelcomePrompt
        isVisible={showWelcomePrompt}
        userName={userName || "there"}
        onAddTodo={(text) => {
          actions.addTodo(text);
          setPendingActiveFromWelcome(true); // Will auto-set as active once added
        }}
        onDismiss={() => setShowWelcomePrompt(false)}
      />
    </div>
  );
}

// Mobile Todo Panel Component
function MobileTodoPanel({
  userTodos,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onSetActiveTodo,
  onSetVisibility,
}: {
  userTodos: import("@/lib/types").UserTodos | null;
  onAddTodo: (text: string) => void;
  onUpdateTodo: (todoId: string, updates: { text?: string; completed?: boolean }) => void;
  onDeleteTodo: (todoId: string) => void;
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
            <TodoList
              userTodos={userTodos}
              onAddTodo={onAddTodo}
              onUpdateTodo={onUpdateTodo}
              onDeleteTodo={onDeleteTodo}
              onSetActiveTodo={onSetActiveTodo}
              onSetVisibility={onSetVisibility}
            />
          </div>
        </div>
      )}
    </>
  );
}
