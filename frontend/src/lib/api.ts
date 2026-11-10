import { RoomSettings, RoomState } from "./types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function createRoom(settings?: Partial<RoomSettings>, creatorId?: string): Promise<{ roomId: string; room: RoomState }> {
  const res = await fetch(`${BACKEND_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings, creatorId }),
  });
  
  if (!res.ok) {
    throw new Error("Failed to create room");
  }
  
  return res.json();
}

export async function submitSuggestion(suggestion: { text: string; name?: string; roomId?: string }): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(suggestion),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Failed to send suggestion");
  }
}

export async function getStats(): Promise<{ focusingNow: number }> {
  const res = await fetch(`${BACKEND_URL}/stats`);

  if (!res.ok) {
    throw new Error("Failed to get stats");
  }

  return res.json();
}

export async function getRoomState(roomId: string): Promise<RoomState | null> {
  const res = await fetch(`${BACKEND_URL}/rooms/${roomId}/state`);
  
  if (res.status === 404) {
    return null;
  }
  
  if (!res.ok) {
    throw new Error("Failed to get room state");
  }
  
  return res.json();
}

export async function getRoomDebug(roomId: string): Promise<{
  roomId: string;
  storedParticipants: Array<{ id: string; name: string; uniqueId: string }>;
  connectedSockets: string[];
  staleParticipants: Array<{ id: string; name: string }>;
}> {
  const res = await fetch(`${BACKEND_URL}/rooms/${roomId}/debug`);
  
  if (!res.ok) {
    throw new Error("Failed to get room debug info");
  }
  
  return res.json();
}
export interface RoomPreview {
  peopleFocusing: number;
  phase: "focus" | "break" | "long_break";
  running: boolean;
  focusMin: number;
  breakMin: number;
  cycleCount: number;
}

// Server-side only: used for link previews of room URLs. Never blocks a page for long.
export async function getRoomPreview(roomId: string): Promise<RoomPreview | null> {
  if (!/^[A-Za-z0-9_-]{1,21}$/.test(roomId)) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/rooms/${roomId}/preview`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(1500),
    });
    return res.ok ? ((await res.json()) as RoomPreview) : null;
  } catch {
    return null;
  }
}

export function describePreview(p: RoomPreview | null): { title: string; subtitle: string } {
  if (!p) {
    return { title: "Join my focus room", subtitle: "Focus together on one shared Pomodoro timer. Free, no sign-up." };
  }
  const who = p.peopleFocusing === 0 ? "Be the first one here" : p.peopleFocusing === 1 ? "1 person focusing now" : `${p.peopleFocusing} people focusing now`;
  return {
    title: "Join my focus room",
    subtitle: `${who} · ${p.focusMin} min focus / ${p.breakMin} min break · free, no sign-up`,
  };
}
