"use client";

import { useState, useRef, useEffect } from "react";

interface WelcomePromptProps {
  isVisible: boolean;
  onAddTodo: (text: string) => void;
  onDismiss: (name: string) => void;
  initialName?: string;
}

export function WelcomePrompt({
  isVisible,
  onAddTodo,
  onDismiss,
  initialName = "",
}: WelcomePromptProps) {
  const [name, setName] = useState(initialName);
  const [todoText, setTodoText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const todoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      // Focus name input after animation
      setTimeout(() => nameInputRef.current?.focus(), 300);
    }
  }, [isVisible]);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  if (!isVisible) return null;

  const handleAddTodo = () => {
    if (name.trim() && todoText.trim()) {
      onAddTodo(todoText.trim());
      setTodoText("");
      handleClose();
    }
  };

  const handleClose = () => {
    if (!name.trim()) return; // Name is required
    setIsAnimating(false);
    setTimeout(() => onDismiss(name.trim()), 200);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      todoInputRef.current?.focus();
    }
  };

  const handleTodoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && todoText.trim() && name.trim()) {
      handleAddTodo();
    }
  };

  const canProceed = name.trim().length > 0;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-300
        ${isAnimating ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Backdrop - no click to close */}
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
            Welcome to Pikoo!
          </h3>
          <p className="text-sm text-white/50 leading-relaxed">
            Let&apos;s get you set up for a productive session.
          </p>
        </div>

        {/* Name input */}
        <div className="mb-4">
          <label className="block text-sm text-white/60 mb-2">
            What should we call you?
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            placeholder="Enter your name"
            maxLength={30}
            className="
              w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
              text-white placeholder-white/30
              focus:outline-none focus:border-blue-500/50 focus:bg-white/10
              transition-all duration-200
            "
          />
        </div>

        {/* Divider with stat */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-black/80 text-xs text-white/40">
              Writing goals increases success by <span className="text-emerald-400">42%</span>
            </span>
          </div>
        </div>

        {/* Todo input */}
        <div className="mb-4">
          <label className="block text-sm text-white/60 mb-2">
            What&apos;s your main task for today? <span className="text-white/30">(optional)</span>
          </label>
          <input
            ref={todoInputRef}
            type="text"
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            onKeyDown={handleTodoKeyDown}
            placeholder="e.g., Finish the project proposal"
            maxLength={200}
            disabled={!canProceed}
            className="
              w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
              text-white placeholder-white/30
              focus:outline-none focus:border-emerald-500/50 focus:bg-white/10
              disabled:opacity-50 disabled:cursor-not-allowed
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
              disabled={!canProceed}
              className="
                px-3 py-1.5 bg-white/5 border border-white/10 rounded-full
                text-xs text-white/50 hover:text-white/80 hover:bg-white/10
                disabled:opacity-30 disabled:cursor-not-allowed
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
            disabled={!canProceed}
            className="
              flex-1 py-3 px-4 rounded-xl
              bg-white/5 border border-white/10 text-white/60
              hover:bg-white/10 hover:text-white/80
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 text-sm font-medium
            "
          >
            Skip goal for now
          </button>
          <button
            onClick={handleAddTodo}
            disabled={!canProceed || !todoText.trim()}
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
          💡 Your name will be visible to others in the room
        </p>
      </div>
    </div>
  );
}
