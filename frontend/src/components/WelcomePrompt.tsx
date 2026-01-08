"use client";

import { useState, useRef, useEffect } from "react";

interface WelcomePromptProps {
  isVisible: boolean;
  onAddTodo: (text: string) => void;
  onDismiss: () => void;
  userName: string;
}

export function WelcomePrompt({
  isVisible,
  onAddTodo,
  onDismiss,
  userName,
}: WelcomePromptProps) {
  const [todoText, setTodoText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const handleAddTodo = () => {
    if (todoText.trim()) {
      onAddTodo(todoText.trim());
      setTodoText("");
      handleClose();
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onDismiss, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && todoText.trim()) {
      handleAddTodo();
    }
  };

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-300
        ${isAnimating ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Backdrop - no click to close, must use Skip button */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-md mx-4 p-6
          bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl
          transform transition-all duration-300
          ${isAnimating ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}
        `}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 mb-4">
            <span className="text-2xl">👋</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Welcome, {userName}!
          </h3>
          <p className="text-sm text-white/50 leading-relaxed">
            Studies show that writing down your goal increases your chances of achieving it by <span className="text-emerald-400 font-medium">42%</span>.
          </p>
        </div>

        {/* Todo input */}
        <div className="mb-4">
          <label className="block text-sm text-white/60 mb-2">
            What&apos;s your main task for today?
          </label>
          <input
            ref={inputRef}
            type="text"
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Finish the project proposal"
            maxLength={200}
            className="
              w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
              text-white placeholder-white/30
              focus:outline-none focus:border-emerald-500/50 focus:bg-white/10
              transition-all duration-200
            "
          />
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["Study for exam", "Work on project", "Read 30 pages", "Write code"].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setTodoText(suggestion)}
              className="
                px-3 py-1.5 bg-white/5 border border-white/10 rounded-full
                text-xs text-white/50 hover:text-white/80 hover:bg-white/10
                transition-all duration-200
              "
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="
              flex-1 py-3 px-4 rounded-xl
              bg-white/5 border border-white/10 text-white/60
              hover:bg-white/10 hover:text-white/80
              transition-all duration-200 text-sm font-medium
            "
          >
            Skip for now
          </button>
          <button
            onClick={handleAddTodo}
            disabled={!todoText.trim()}
            className="
              flex-1 py-3 px-4 rounded-xl
              bg-emerald-500/20 border border-emerald-500/30 text-emerald-300
              hover:bg-emerald-500/30 hover:text-emerald-200
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 text-sm font-medium
            "
          >
            Add & Start Focusing
          </button>
        </div>

        {/* Tip */}
        <p className="mt-4 text-xs text-white/30 text-center">
          💡 You can always add more tasks from the sidebar
        </p>
      </div>
    </div>
  );
}

