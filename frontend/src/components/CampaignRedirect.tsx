"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { STUDY_ROOMS, librarySchedule, displayedLibraryCount } from "@/lib/library";
import { trace } from "@/lib/trace";

// Visitors who arrive at /library from an outside link (an email, a post) have
// so far left from the room list without joining anything. Send them straight
// into the busiest study room instead, keeping the link's tags. Rooms in a break
// or within 5 minutes of the end of focus come last, so people land at a
// moment when everyone is actually working. The list is one tap away via the
// room's back link, which carries no tags and so doesn't redirect again.
export function CampaignRedirect() {
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("utm_source") && !params.get("ref")) return;
    const now = Date.now();
    const ranked = STUDY_ROOMS.map((room) => {
      const s = librarySchedule(room, now);
      const good = s.phase === "focus" && s.remainingSec >= 5 * 60;
      return { room, score: (good ? 1_000_000 : 0) + displayedLibraryCount(room.id, 0, now) };
    }).sort((a, b) => b.score - a.score);
    const target = ranked[0].room;
    trace("auto_room", { room: target.id, utm: params.get("utm_source") ?? undefined });
    router.replace(`/library/${target.id}?${params.toString()}`);
  }, [router]);
  return null;
}
