// ============================================
// Pikoo - Redis Store for Room State
// ============================================

import Redis from "ioredis";
import {
  RoomState,
  RoomSettings,
  TimerState,
  DEFAULT_SETTINGS,
  getInitialTimerState,
  getPhaseDuration,
  Phase,
} from "./types.js";

const ROOM_TTL = 60 * 60 * 24; // 24 hours

// In-memory fallback if Redis is not available
const memoryStore = new Map<string, RoomState>();

let redis: Redis | null = null;

export function initRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log("⚠️  No REDIS_URL found, using in-memory store (not for production!)");
    return null;
  }

  try {
    redis = new Redis(redisUrl);
    redis.on("error", (err) => {
      console.error("Redis error:", err);
    });
    redis.on("connect", () => {
      console.log("✅ Connected to Redis");
    });
    return redis;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    return null;
  }
}

// ============================================
// Room Operations
// ============================================

export async function createRoom(
  roomId: string,
  settings: Partial<RoomSettings> = {},
  hostId: string | null = null
): Promise<RoomState> {
  const fullSettings: RoomSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  const room: RoomState = {
    id: roomId,
    settings: fullSettings,
    timer: getInitialTimerState(fullSettings),
    hostId,
    createdAt: Date.now(),
    participants: [],
  };

  await saveRoom(room);
  return room;
}

export async function getRoom(roomId: string): Promise<RoomState | null> {
  if (redis) {
    const data = await redis.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
  }
  return memoryStore.get(roomId) || null;
}

export async function saveRoom(room: RoomState): Promise<void> {
  if (redis) {
    await redis.setex(`room:${room.id}`, ROOM_TTL, JSON.stringify(room));
  } else {
    memoryStore.set(room.id, room);
  }
}

export async function deleteRoom(roomId: string): Promise<void> {
  if (redis) {
    await redis.del(`room:${roomId}`);
  } else {
    memoryStore.delete(roomId);
  }
}

// ============================================
// Timer Operations
// ============================================

export async function startTimer(roomId: string): Promise<TimerState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  const now = Date.now();
  room.timer.running = true;
  room.timer.phaseEndsAt = now + room.timer.remainingSecWhenPaused * 1000;

  await saveRoom(room);
  return room.timer;
}

export async function pauseTimer(roomId: string): Promise<TimerState | null> {
  const room = await getRoom(roomId);
  if (!room || !room.timer.running) return room?.timer || null;

  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((room.timer.phaseEndsAt! - now) / 1000));
  
  room.timer.running = false;
  room.timer.phaseEndsAt = null;
  room.timer.remainingSecWhenPaused = remaining;

  await saveRoom(room);
  return room.timer;
}

export async function resetTimer(roomId: string): Promise<TimerState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  const duration = getPhaseDuration(room.timer.phase, room.settings);
  room.timer.running = false;
  room.timer.phaseEndsAt = null;
  room.timer.remainingSecWhenPaused = duration;

  await saveRoom(room);
  return room.timer;
}

export async function skipPhase(roomId: string): Promise<TimerState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  // Determine next phase
  let nextPhase: Phase;
  let newCycleCount = room.timer.cycleCount;

  if (room.timer.phase === "focus") {
    newCycleCount++;
    // Check if it's time for a long break
    if (newCycleCount % room.settings.longBreakEvery === 0) {
      nextPhase = "long_break";
    } else {
      nextPhase = "break";
    }
  } else {
    // After any break, go back to focus
    nextPhase = "focus";
  }

  const duration = getPhaseDuration(nextPhase, room.settings);
  room.timer.phase = nextPhase;
  room.timer.cycleCount = newCycleCount;
  room.timer.running = false;
  room.timer.phaseEndsAt = null;
  room.timer.remainingSecWhenPaused = duration;

  await saveRoom(room);
  return room.timer;
}

// ============================================
// Participant Operations
// ============================================

export async function addParticipant(
  roomId: string,
  participantId: string
): Promise<string[]> {
  const room = await getRoom(roomId);
  if (!room) return [];

  if (!room.participants.includes(participantId)) {
    room.participants.push(participantId);
    await saveRoom(room);
  }
  return room.participants;
}

export async function removeParticipant(
  roomId: string,
  participantId: string
): Promise<string[]> {
  const room = await getRoom(roomId);
  if (!room) return [];

  room.participants = room.participants.filter((p) => p !== participantId);
  
  // If host leaves in host mode, assign new host or clear
  if (room.hostId === participantId) {
    room.hostId = room.participants[0] || null;
  }

  await saveRoom(room);
  return room.participants;
}

export async function updateSettings(
  roomId: string,
  settings: Partial<RoomSettings>
): Promise<RoomSettings | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  room.settings = { ...room.settings, ...settings };
  await saveRoom(room);
  return room.settings;
}

