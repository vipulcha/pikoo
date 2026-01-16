import { RoomSettings, RoomState } from "./types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function createRoom(settings?: Partial<RoomSettings>): Promise<{ roomId: string; room: RoomState }> {
  const res = await fetch(`${BACKEND_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  
  if (!res.ok) {
    throw new Error("Failed to create room");
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