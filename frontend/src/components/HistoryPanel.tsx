"use client";

import { useState } from "react";
import { ActivityLog, ActivityType } from "@/lib/types";

interface HistoryPanelProps {
    history: ActivityLog[];
}

export function HistoryPanel({ history }: HistoryPanelProps) {
    const [isHovered, setIsHovered] = useState(false);

    if (!history || history.length === 0) {
        return null;
    }

    const latestLog = history[0];

    const getIcon = (type: ActivityType) => {
        switch (type) {
            case "timer_start": return "▶️";
            case "timer_pause": return "⏸️";
            case "timer_reset": return "🔄";
            case "timer_skip": return "⏭️";
            case "join": return "👋";
            case "leave": return "🚪";
            default: return "📝";
        }
    };

    const getDescription = (log: ActivityLog) => {
        switch (log.type) {
            case "timer_start": return `started the timer (${log.details})`;
            case "timer_pause": return `paused the timer (${log.details})`;
            case "timer_reset": return `reset the timer`;
            case "timer_skip": return log.details || `skipped phase`;
            case "join": return `joined the room`;
            case "leave": return `left the room`;
            default: return "performed an action";
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            className="relative w-full max-w-[18rem] z-20 h-10 mb-4"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Container - Expands upwards on hover using absolute bottom-0 */}
            <div
                className={`
          absolute bottom-0 left-0 right-0
          transition-all duration-300 ease-in-out
          bg-black/30 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden flex flex-col-reverse
          ${isHovered ? "max-h-60 shadow-xl bg-black/80" : "max-h-10 bg-transparent border-transparent"}
        `}
            >
                {/* Latest Log (Always at the bottom of the flex column) */}
                <div className={`px-3 py-2 text-xs flex items-center gap-2 truncate cursor-default flex-shrink-0
                    ${isHovered ? "border-t border-white/5 bg-white/5" : "text-white/40"}
                `}>
                    {!isHovered ? (
                        <>
                            <span>{getIcon(latestLog.type)}</span>
                            <span className="font-medium text-white/60">{latestLog.userName}</span>
                            <span className="truncate">{getDescription(latestLog)}</span>
                            <span className="ml-auto opacity-50">{formatTime(latestLog.timestamp)}</span>
                        </>
                    ) : (
                        <div className="text-white/30 uppercase tracking-wider font-semibold w-full text-center text-[10px]">
                            Recent Activity
                        </div>
                    )}
                </div>

                {/* Full History List (Visible on hover) */}
                {isHovered && (
                    <div className="overflow-y-auto max-h-48 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex flex-col">
                        {history.map((log) => (
                            <div key={log.id} className="px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 border-white/5">
                                <div className="flex items-start gap-2 text-xs text-white/80">
                                    <span className="flex-shrink-0 mt-0.5">{getIcon(log.type)}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                            <span className="font-medium text-amber-200/80">{log.userName}</span>
                                            <span className="text-white/40 text-[10px] ml-auto">{formatTime(log.timestamp)}</span>
                                        </div>
                                        <p className="text-white/60 truncate leading-relaxed">
                                            {getDescription(log)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
