"use client";

import { useState, useEffect } from "react";
import { TodoItem, UserTodos } from "@/lib/types";

interface SessionPromptProps {
  isVisible: boolean;
  userTodos: UserTodos | null;
  onSelectTodo: (todoId: string | null) => void;
  onDismiss: () => void;
}

export function SessionPrompt({
  isVisible,
  userTodos,
  onSelectTodo,
  onDismiss,
}: SessionPromptProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const todos = userTodos?.todos || [];
  const incompleteTodos = todos.filter(t => !t.completed);
  const activeTodoId = userTodos?.activeTodoId;

  // If no incomplete todos, don't show prompt
  if (incompleteTodos.length === 0) {
    return null;
  }

  const handleSelectTodo = (todoId: string) => {
    onSelectTodo(todoId);
    setIsAnimating(false);
    setTimeout(onDismiss, 200);
  };

  const handleSkip = () => {
    setIsAnimating(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-300
        ${isAnimating ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />

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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/20 mb-3">
            <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            New Focus Session
          </h3>
          <p className="text-sm text-white/50">
            What will you work on this session?
          </p>
        </div>

        {/* Todo list */}
        <div className="max-h-64 overflow-y-auto mb-4 space-y-2">
          {incompleteTodos.map((todo) => (
            <button
              key={todo.id}
              onClick={() => handleSelectTodo(todo.id)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-xl text-left
                transition-all duration-200 border
                ${todo.id === activeTodoId
                  ? "bg-rose-500/15 border-rose-500/30 text-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
                }
              `}
            >
              <div className={`
                w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                transition-colors duration-200
                ${todo.id === activeTodoId
                  ? "border-rose-400 bg-rose-500/30"
                  : "border-white/30"
                }
              `}>
                {todo.id === activeTodoId && (
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                )}
              </div>
              <span className="flex-1 text-sm truncate">{todo.text}</span>
              {todo.id === activeTodoId && (
                <span className="text-xs text-rose-400/80 bg-rose-500/10 px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="
              flex-1 py-2.5 px-4 rounded-xl
              bg-white/5 border border-white/10 text-white/60
              hover:bg-white/10 hover:text-white/80
              transition-all duration-200 text-sm font-medium
            "
          >
            Skip for now
          </button>
          {activeTodoId && (
            <button
              onClick={() => handleSelectTodo(activeTodoId)}
              className="
                flex-1 py-2.5 px-4 rounded-xl
                bg-rose-500/20 border border-rose-500/30 text-rose-300
                hover:bg-rose-500/30 hover:text-rose-200
                transition-all duration-200 text-sm font-medium
              "
            >
              Continue current
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

