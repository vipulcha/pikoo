// ============================================
// "Work with the developer" room (/work-with-dev)
// ============================================
// One permanent public room that opens only while Pikoo's developer is live in
// it. The developer's browser is recognised by its room secret (the random
// pikoo_user_secret every browser keeps in localStorage): only its SHA-256 is
// stored here. The secret is 24 random bytes, so publishing the hash is safe.
// If that browser's storage is ever cleared, put the new hash here (or set
// DEV_HOST_SECRET_SHA256 on the server) and in frontend/src/lib/devRoom.ts.

import { createHash } from "crypto";
import { RoomState, RoomSettings } from "./types.js";
import { getRoom, createRoom } from "./store.js";

// An underscore can't appear in a custom room link, so nobody can claim this id
export const DEV_ROOM_ID = "work_with_dev";

const DEV_HOST_SECRET_SHA256 =
  process.env.DEV_HOST_SECRET_SHA256 || "6535361a8ed36c62d0405242aff5119d9ba72e6e296792a8b6485af94309a229";

/** The developer's name in the room, whatever name their browser has saved */
export const DEV_NAME = "Pikoo developer";

/** After the developer's last connection is gone (and its grace period is over), end the session this much later */
export const DEV_AWAY_MS = 60_000;

const DEV_ROOM_SETTINGS: Partial<RoomSettings> = {
  focusSec: 50 * 60,
  breakSec: 10 * 60,
  longBreakSec: 20 * 60,
  longBreakEvery: 4,
  mode: "host",
  autoStart: true,
};

export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function isDevHostSecret(secret: string | null | undefined): boolean {
  return !!secret && hashSecret(secret) === DEV_HOST_SECRET_SHA256;
}

/** Names visitors can't pick here, so nobody passes as the developer */
export function isReservedDevName(name: string): boolean {
  const n = name.toLowerCase().replace(/[^a-z]/g, "");
  return n.includes("pikoo") || n.includes("developer") || n === "dev" || n === "admin" || n === "host";
}

/** The room, created on first use (and again if it ever expired) */
export async function ensureDevRoom(): Promise<RoomState | null> {
  return (await getRoom(DEV_ROOM_ID)) ?? (await createRoom(DEV_ROOM_ID, DEV_ROOM_SETTINGS, null));
}

export interface DevRoomStatus {
  live: boolean;
  since: number | null;
  /** Distinct people in the room, the developer included */
  people: number;
  focusMin: number;
  breakMin: number;
  phase: RoomState["timer"]["phase"];
  running: boolean;
  phaseEndsAt: number | null;
  remainingSecWhenPaused: number;
  schedule: RoomState["schedule"] | null;
}

export async function devRoomStatus(): Promise<DevRoomStatus> {
  const room = await ensureDevRoom();
  const live = !!room?.devLive;
  return {
    live,
    since: room?.devLive?.since ?? null,
    people: live && room ? new Set(room.participants.map((p) => p.uniqueId)).size : 0,
    focusMin: Math.round((room?.settings.focusSec ?? 3000) / 60),
    breakMin: Math.round((room?.settings.breakSec ?? 600) / 60),
    phase: room?.timer.phase ?? "focus",
    running: !!room?.timer.running,
    phaseEndsAt: room?.timer.phaseEndsAt ?? null,
    remainingSecWhenPaused: room?.timer.remainingSecWhenPaused ?? 0,
    schedule: room?.schedule ?? null,
  };
}
