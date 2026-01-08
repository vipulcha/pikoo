"use client";

import { useState, useRef, useEffect } from "react";
import { Participant } from "@/lib/types";

interface ParticipantCountProps {
  participants: Participant[];
  isConnected: boolean;
}

export function ParticipantCount({ participants, isConnected }: ParticipantCountProps) {
  const [showList, setShowList] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowList(false);
      }
    };

    if (showList) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showList]);

  const count = participants.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setShowList(!showList)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10
          hover:bg-white/10 transition-colors cursor-pointer
          ${showList ? "bg-white/10" : ""}
        `}
      >
        {/* Connection status dot */}
        <span 
          className={`
            w-2 h-2 rounded-full transition-colors
            ${isConnected ? "bg-green-400" : "bg-red-400 animate-pulse"}
          `}
        />
        
        {/* People icon */}
        <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        
        {/* Count */}
        <span className="text-white/80 text-sm font-medium">
          {count} {count === 1 ? "person" : "people"}
        </span>
      </button>

      {/* Dropdown list */}
      {showList && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs text-white/50 uppercase tracking-wide">In this room</p>
          </div>
          <ul className="py-1 max-h-48 overflow-y-auto">
            {participants.map((participant, index) => (
              <li 
                key={participant.id} 
                className="px-3 py-2 flex items-center gap-2 hover:bg-white/5"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-purple-500 flex items-center justify-center text-xs font-medium">
                  {participant.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-white/80 text-sm truncate">
                  {participant.name}
                  {index === 0 && (
                    <span className="ml-1 text-xs text-white/40">(host)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
