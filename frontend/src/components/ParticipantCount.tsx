"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Participant } from "@/lib/types";

interface ParticipantCountProps {
  participants: Participant[];
  isConnected: boolean;
}

interface GroupedParticipant {
  uniqueId: string;
  name: string;
  connectionCount: number;
  isFirst: boolean;  // First participant is the host
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

  // Group participants by uniqueId (same user with multiple tabs = 1 entry)
  const groupedParticipants = useMemo(() => {
    const groups = new Map<string, GroupedParticipant>();
    let firstUniqueId: string | null = null;
    
    for (const p of participants) {
      // Track the first uniqueId (host)
      if (!firstUniqueId) {
        firstUniqueId = p.uniqueId;
      }
      
      const existing = groups.get(p.uniqueId);
      if (existing) {
        existing.connectionCount++;
      } else {
        groups.set(p.uniqueId, {
          uniqueId: p.uniqueId,
          name: p.name,
          connectionCount: 1,
          isFirst: p.uniqueId === firstUniqueId,
        });
      }
    }
    
    return Array.from(groups.values());
  }, [participants]);

  const uniqueCount = groupedParticipants.length;

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
          {uniqueCount} {uniqueCount === 1 ? "person" : "people"}
        </span>
      </button>

      {/* Dropdown list */}
      {showList && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs text-white/50 uppercase tracking-wide">In this room</p>
          </div>
          <ul className="py-1 max-h-48 overflow-y-auto">
            {groupedParticipants.map((participant) => (
              <li 
                key={participant.uniqueId} 
                className="px-3 py-2 flex items-center gap-2 hover:bg-white/5"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-purple-500 flex items-center justify-center text-xs font-medium">
                  {participant.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-white/80 text-sm truncate flex-1">
                  {participant.name}
                </span>
                <span className="flex items-center gap-1">
                  {participant.isFirst && (
                    <span className="text-xs text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">host</span>
                  )}
                  {participant.connectionCount > 1 && (
                    <span className="text-xs text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                      {participant.connectionCount} tabs
                    </span>
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
