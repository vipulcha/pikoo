// Room names: a room created with a name lives at /r/<name> and can also be
// typed as pikoo…/<name> (resolved by the 404 page, see components/MissingRoom).

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

/** Same rule as the backend (sanitizeRoomSlug): 3-32 lowercase letters, digits and single hyphens */
export const ROOM_NAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?!-)){1,30}[a-z0-9]$/;

/** Names the backend refuses. Guide page names are added by the server pages that know them. */
const BACKEND_RESERVED = [
  "new", "create", "admin", "api", "embed", "library", "timer", "settings", "pikoo", "help", "about",
  "dashboard", "obs", "work-with-dev", "icon", "apple-icon", "opengraph-image", "manifest", "robots", "sitemap", "llms",
];

/** What people type → a room name: "Study Buddies!" → "study-buddies" */
export const toRoomName = (raw: string) =>
  raw.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 32);

/** Why a name can't be used, or null if it can */
export function roomNameProblem(name: string, reserved: readonly string[] = []): string | null {
  if (name.replace(/-/g, "").length < 3) return "Use at least 3 letters or numbers";
  if (!ROOM_NAME_RE.test(name)) return "Start and end with a letter or number";
  if (BACKEND_RESERVED.includes(name) || reserved.includes(name)) return "That name belongs to a Pikoo page, try another";
  return null;
}

/** true / false, or null when the server couldn't be asked */
export async function roomExists(id: string, signal?: AbortSignal): Promise<boolean | null> {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/rooms/${id}/preview`, { signal, cache: "no-store" });
    if (res.ok) return true;
    return res.status === 404 ? false : null;
  } catch {
    return null;
  }
}

/** The room a typed name points to: exact first (room codes are case-sensitive), then as a name */
export async function resolveRoom(raw: string): Promise<{ id: string | null; failed: boolean }> {
  const candidates = [...new Set([raw, raw.toLowerCase(), toRoomName(raw)])].filter((c) => /^[A-Za-z0-9_-]{1,40}$/.test(c));
  const found = await Promise.all(candidates.map((c) => roomExists(c)));
  const i = found.findIndex((f) => f === true);
  return { id: i >= 0 ? candidates[i] : null, failed: i < 0 && found.some((f) => f === null) };
}
