"use client";

import { useState } from "react";
import { UserTodos, Participant } from "@/lib/types";

interface OthersTodosProps {
  userTodos: Record<string, UserTodos>;
  currentUserId: string;
  participants: Participant[];
}

export function OthersTodos({ userTodos, currentUserId, participants }: OthersTodosProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Get other users' public todos (filter out current user and private lists)
  const otherUsers = Object.values(userTodos).filter(
    (ut) => ut.userId !== currentUserId && ut.isPublic && ut.todos.length > 0
  );

  // Get currently active users (those who are in the room right now)
  const activeUserIds = new Set(participants.map(p => p.uniqueId));
  
  // Sort: active users first, then by name
  const sortedOtherUsers = [...otherUsers].sort((a, b) => {
    const aActive = activeUserIds.has(a.userId);
    const bActive = activeUserIds.has(b.userId);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return a.userName.localeCompare(b.userName);
  });

  const selectedUser = selectedUserId 
    ? userTodos[selectedUserId] 
    : sortedOtherUsers[0] || null;

  const totalOtherTodos = otherUsers.reduce((sum, u) => sum + u.todos.length, 0);

  if (otherUsers.length === 0) {
    return null; // Don't show if no one else has public todos
  }

  return (
    <div className="fixed bottom-4 left-4 z-30">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-xl
          backdrop-blur-xl border transition-all duration-300
          ${isOpen 
            ? "bg-white/15 border-white/20 text-white shadow-lg" 
            : "bg-black/40 border-white/10 text-white/70 hover:text-white hover:bg-black/50"
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
        <span className="text-sm font-medium">Team Tasks</span>
        <span className="px-1.5 py-0.5 bg-white/10 rounded-full text-xs">
          {totalOtherTodos}
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-14 left-0 w-80 animate-fade-in">
          <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* User tabs */}
            <div className="flex overflow-x-auto border-b border-white/10 p-1 gap-1 scrollbar-none">
              {sortedOtherUsers.map((user) => {
                const isSelected = selectedUser?.userId === user.userId;
                const isActiveInRoom = activeUserIds.has(user.userId);
                
                return (
                  <button
                    key={user.userId}
                    onClick={() => setSelectedUserId(user.userId)}
                    className={`
                      flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium
                      transition-all duration-200 flex items-center gap-1.5
                      ${isSelected 
                        ? "bg-white/15 text-white" 
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }
                    `}
                  >
                    {isActiveInRoom && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    <span className="truncate max-w-[100px]">{user.userName}</span>
                    <span className="text-xs opacity-60">({user.todos.length})</span>
                  </button>
                );
              })}
            </div>

            {/* Todo list */}
            {selectedUser && (
              <div className="p-3 max-h-64 overflow-y-auto">
                {/* Active task indicator */}
                {selectedUser.activeTodoId && (
                  <div className="mb-3 px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs text-rose-400/80 mb-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                      </svg>
                      <span>Currently working on</span>
                    </div>
                    <p className="text-sm text-white/90">
                      {selectedUser.todos.find(t => t.id === selectedUser.activeTodoId)?.text}
                    </p>
                  </div>
                )}

                {/* All todos */}
                <div className="space-y-1.5">
                  {selectedUser.todos
                    .filter(t => t.id !== selectedUser.activeTodoId) // Don't show active again
                    .sort((a, b) => {
                      if (a.completed && !b.completed) return 1;
                      if (!a.completed && b.completed) return -1;
                      return b.createdAt - a.createdAt;
                    })
                    .map((todo) => (
                      <div
                        key={todo.id}
                        className={`
                          flex items-start gap-2 p-2 rounded-lg bg-white/5
                          ${todo.completed ? "opacity-50" : ""}
                        `}
                      >
                        <div
                          className={`
                            mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
                            ${todo.completed 
                              ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-400" 
                              : "border-white/20"
                            }
                          `}
                        >
                          {todo.completed && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <p
                          className={`
                            text-sm leading-snug break-words
                            ${todo.completed ? "line-through text-white/40" : "text-white/70"}
                          `}
                        >
                          {todo.text}
                        </p>
                      </div>
                    ))}
                </div>

                {selectedUser.todos.length === 0 && (
                  <div className="text-center py-4 text-white/30 text-sm">
                    No tasks yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

