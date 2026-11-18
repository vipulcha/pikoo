// Server-side read of the real headcount in each silent room, so pages ship
// with numbers in the HTML instead of filling them in after JavaScript runs.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function fetchLibraryCounts(): Promise<Record<string, number> | undefined> {
  try {
    // No data cache: a cached count is served stale after quiet periods. Per-request
    // pages fetch on every request; the homepage fetches each time it regenerates.
    const res = await fetch(`${BACKEND_URL}/library`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return undefined;
    const d = (await res.json()) as { rooms: { id: string; count: number }[] };
    return Object.fromEntries(d.rooms.map((r) => [r.id, r.count]));
  } catch {
    return undefined;
  }
}

/** The moment a page was rendered plus the real counts at that moment */
export async function librarySnapshot(): Promise<{ now: number; counts?: Record<string, number> }> {
  const counts = await fetchLibraryCounts();
  return { now: Date.now(), counts };
}
