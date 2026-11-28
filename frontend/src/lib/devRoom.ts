// "Work with the developer" room: one permanent public room (/work-with-dev)
// that is open only while Pikoo's developer is live in it. See backend/src/devRoom.ts.
import type { Phase, RoomSchedule } from "./types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const DEV_ROOM_ID = "work_with_dev";
export const DEV_PATH = "/work-with-dev";

// SHA-256 of the developer's browser secret (pikoo_user_secret). Only used to show
// the developer's controls; the server checks the secret itself. Keep in sync with
// backend/src/devRoom.ts.
export const DEV_HOST_SECRET_SHA256 =
  process.env.NEXT_PUBLIC_DEV_HOST_SECRET_SHA256 || "6535361a8ed36c62d0405242aff5119d9ba72e6e296792a8b6485af94309a229";

export interface DevRoomStatus {
  live: boolean;
  since: number | null;
  /** Distinct people in the room, the developer included */
  people: number;
  focusMin: number;
  breakMin: number;
  phase: Phase;
  running: boolean;
  phaseEndsAt: number | null;
  remainingSecWhenPaused: number;
  schedule: RoomSchedule | null;
}

/** Live status, or undefined if the backend can't be reached */
export async function fetchDevStatus(timeoutMs = 4000): Promise<DevRoomStatus | undefined> {
  try {
    const res = await fetch(`${BACKEND_URL}/dev-room`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return undefined;
    return (await res.json()) as DevRoomStatus;
  } catch {
    return undefined;
  }
}

/** "1h 20m", "35 min" */
export function sinceLabel(since: number, now: number): string {
  const min = Math.max(0, Math.floor((now - since) / 60_000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}
