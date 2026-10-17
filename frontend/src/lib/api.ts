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