// Server-side read of the real headcount in each silent room, so pages ship
// with numbers in the HTML instead of filling them in after JavaScript runs.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface LibraryData {
  /** People in each room right now */
  counts: Record<string, number>;
  /** People who stayed 10+ minutes in each room over the last 7 days */
  focused: Record<string, number>;
}

async function fetchLibraryData(): Promise<LibraryData | undefined> {
  try {
    // No data cache: a cached count is served stale after quiet periods. Per-request
    // pages fetch on every request; the homepage fetches each time it regenerates.
    const res = await fetch(`${BACKEND_URL}/library`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return undefined;
    const d = (await res.json()) as { rooms: { id: string; count: number; focusedThisWeek?: number }[] };
    return {
      counts: Object.fromEntries(d.rooms.map((r) => [r.id, r.count])),
      focused: Object.fromEntries(d.rooms.map((r) => [r.id, r.focusedThisWeek ?? 0])),
    };
  } catch {
    return undefined;
  }
}

/** The moment a page was rendered plus the real numbers at that moment */
export async function librarySnapshot(): Promise<{ now: number; counts?: Record<string, number>; focused?: Record<string, number> }> {
  const data = await fetchLibraryData();
  return { now: Date.now(), counts: data?.counts, focused: data?.focused };
}
