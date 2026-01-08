"use client";

import { useState, useEffect } from "react";

interface NamePromptProps {
  isOpen: boolean;
  onSubmit: (name: string) => void;
  title?: string;
  subtitle?: string;
  errorMessage?: string;  // External error (e.g., "Name already taken")
}

const STORAGE_KEY = "pikoo_user_name";
const USER_ID_KEY = "pikoo_user_id";

export function NamePrompt({ isOpen, onSubmit, title = "Enter your name", subtitle, errorMessage }: NamePromptProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  // Load saved name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_KEY);
    if (savedName) {
      setName(savedName);
    }
  }, []);

  // Show external error
  useEffect(() => {
    if (errorMessage) {
      setError(errorMessage);
    }
  }, [errorMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }
    
    if (trimmedName.length > 20) {
      setError("Name must be 20 characters or less");
      return;
    }

    // Save to localStorage for future sessions
    localStorage.setItem(STORAGE_KEY, trimmedName);
    onSubmit(trimmedName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-black/90 border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl animate-slide-up">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        {subtitle && (
          <p className="text-white/60 mb-6">{subtitle}</p>
        )}
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="Your name"
            autoFocus
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
            maxLength={20}
          />
          
          {error && (
            <p className="text-rose-400 text-sm mt-2">{error}</p>
          )}
          
          <button
            type="submit"
            className="w-full mt-4 py-3 px-6 rounded-xl font-medium bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 transition-all shadow-lg shadow-rose-500/25"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

// Helper to get saved name
export function getSavedName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

// Helper to clear saved name (used when name is taken)
export function clearSavedName(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// Helper to get or create unique user ID (persistent across sessions)
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // Generate a unique ID
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

