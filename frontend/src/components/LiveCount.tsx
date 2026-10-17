"use client";

import { useEffect, useState } from "react";
import { getStats } from "@/lib/api";

// Below this the count reads as "empty" rather than social proof, so we hide it
const MIN_TO_SHOW = 2;

export function LiveCount() {
  const [focusingNow, setFocusingNow] = useState<number | null>(null);

  useEffect(() => {
    getStats()
      .then((stats) => setFocusingNow(stats.focusingNow))
      .catch(() => setFocusingNow(null));
  }, []);

  if (focusingNow === null || focusingNow < MIN_TO_SHOW) return null;

  return (
    <div className="relative mt-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 animate-fade-in">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      {focusingNow} people focusing right now
    </div>
  );
}
