"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
}

export function ChatPanel({ messages, onSendMessage, isOpen, onToggle, unreadCount }: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track client mount for hydration-safe rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    
    onSendMessage(trimmed);
    setInputText("");
  };

  // Format time only on client to avoid hydration mismatch
  const formatTime = (timestamp: number) => {
    if (!isMounted) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* Toggle Button - only show when chat is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-4 bottom-4 z-40 px-4 py-2.5 rounded-xl shadow-2xl transition-all duration-300 bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 hover:bg-white/20 text-sm font-medium"
        >
          Talk to Room Mates!
          
          {/* Unread indicator */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
          )}
        </button>
      )}

      {/* Chat Panel Drawer */}
      <div 
        className={`
          fixed right-0 top-0 h-full w-80 sm:w-96 z-30
          bg-black/80 backdrop-blur-xl border-l border-white/10
          transform transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-medium text-white">Chat</h3>
          <button
            onClick={onToggle}
            className="text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: "calc(100% - 140px)" }}>
          {messages.length === 0 ? (
            <div className="text-center text-white/40 py-8">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="group">
                <div className="flex items-start gap-2">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-500 to-purple-500 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {msg.senderName.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Name and time */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-white/90">{msg.senderName}</span>
                      <span className="text-xs text-white/30">{formatTime(msg.timestamp)}</span>
                    </div>
                    
                    {/* Message text */}
                    <p className="text-sm text-white/70 break-words mt-0.5">
                      {msg.text}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-black/50">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-4 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 sm:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}

