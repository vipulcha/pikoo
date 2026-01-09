// ============================================
// Pikoo - Redis Store for Room State
// ============================================

import Redis from "ioredis";
import {
  RoomState,
  RoomSettings,
  TimerState,
  Participant,
  ChatMessage,
  TodoItem,
  UserTodos,
  DEFAULT_SETTINGS,
  getInitialTimerState,
  getPhaseDuration,
  Phase,
} from "./types.js";

const MAX_MESSAGES = 100; // Keep last 100 messages per room

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
    messages: [],
    userTodos: {},
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

export interface AddParticipantResult {
  success: boolean;
  error?: string;
  participants: Participant[];
}

export async function addParticipant(
  roomId: string,
  socketId: string,
  uniqueId: string,
  participantName: string
): Promise<AddParticipantResult> {
  const room = await getRoom(roomId);
  if (!room) return { success: false, error: "Room not found", participants: [] };

  // Check if this socket is already connected (reconnection)
  const existingSocket = room.participants.find(p => p.id === socketId);
  if (existingSocket) {
    return { success: true, participants: room.participants };
  }

  // Check if name is taken by a DIFFERENT user (different uniqueId)
  const nameTaken = room.participants.find(
    p => p.name.toLowerCase() === participantName.toLowerCase() && p.uniqueId !== uniqueId
  );
  if (nameTaken) {
    return { 
      success: false, 
      error: "Name already taken in this room", 
      participants: room.participants 
    };
  }

  // Add the participant (same user can have multiple tabs)
  room.participants.push({ 
    id: socketId, 
    uniqueId, 
    name: participantName 
  });
  await saveRoom(room);
  
  return { success: true, participants: room.participants };
}

export async function removeParticipant(
  roomId: string,
  participantId: string,
  retries = 3
): Promise<Participant[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const room = await getRoom(roomId);
    if (!room) return [];

    const beforeCount = room.participants.length;
    room.participants = room.participants.filter((p) => p.id !== participantId);
    const afterCount = room.participants.length;
    
    // If participant wasn't found, they're already removed
    if (beforeCount === afterCount) {
      console.log(`[removeParticipant] Participant ${participantId.slice(-6)} already removed from ${roomId}`);
      return room.participants;
    }
    
    // If host leaves in host mode, assign new host or clear
    if (room.hostId === participantId) {
      room.hostId = room.participants[0]?.id || null;
    }

    await saveRoom(room);
    
    // Verify the save worked by re-reading
    const verifyRoom = await getRoom(roomId);
    if (verifyRoom) {
      const stillExists = verifyRoom.participants.find(p => p.id === participantId);
      if (!stillExists) {
        console.log(`[removeParticipant] Successfully removed ${participantId.slice(-6)}, now ${verifyRoom.participants.length} participants`);
        return verifyRoom.participants;
      } else {
        console.log(`[removeParticipant] Race condition detected! Participant ${participantId.slice(-6)} still exists, retry ${attempt + 1}/${retries}`);
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    } else {
      return [];
    }
  }
  
  // Final attempt - just return current state
  console.log(`[removeParticipant] Failed after ${retries} retries for ${participantId.slice(-6)}`);
  const finalRoom = await getRoom(roomId);
  return finalRoom?.participants || [];
}

export async function updateParticipantName(
  roomId: string,
  socketId: string,
  uniqueId: string,
  newName: string
): Promise<{ success: boolean; error?: string; participants: Participant[] }> {
  const room = await getRoom(roomId);
  if (!room) return { success: false, error: "Room not found", participants: [] };

  // Check if new name is taken by a DIFFERENT user
  const nameTaken = room.participants.find(
    p => p.name.toLowerCase() === newName.toLowerCase() && p.uniqueId !== uniqueId
  );
  if (nameTaken) {
    return { 
      success: false, 
      error: "Name already taken in this room", 
      participants: room.participants 
    };
  }

  // Update name for all connections of this user (same uniqueId)
  room.participants = room.participants.map(p => 
    p.uniqueId === uniqueId ? { ...p, name: newName } : p
  );

  // Also update the userName in userTodos
  if (room.userTodos[uniqueId]) {
    room.userTodos[uniqueId].userName = newName;
  }

  await saveRoom(room);
  return { success: true, participants: room.participants };
}

export async function updateSettings(
  roomId: string,
  settings: Partial<RoomSettings>
): Promise<RoomSettings | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  room.settings = { ...room.settings, ...settings };
  
  // If timer is paused and we changed a duration setting, update the timer
  if (!room.timer.running) {
    const newDuration = getPhaseDuration(room.timer.phase, room.settings);
    room.timer.remainingSecWhenPaused = newDuration;
  }
  
  await saveRoom(room);
  return room.settings;
}

// ============================================
// Chat Operations
// ============================================

export async function addMessage(
  roomId: string,
  message: ChatMessage
): Promise<ChatMessage | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  // Initialize messages array if it doesn't exist (for older rooms)
  if (!room.messages) {
    room.messages = [];
  }

  // Add message
  room.messages.push(message);

  // Trim to max messages
  if (room.messages.length > MAX_MESSAGES) {
    room.messages = room.messages.slice(-MAX_MESSAGES);
  }

  await saveRoom(room);
  return message;
}

// ============================================
// Todo Operations
// ============================================

const MAX_TODOS_PER_USER = 50;

export async function ensureUserTodos(
  roomId: string,
  userId: string,
  userName: string
): Promise<UserTodos | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  // Initialize userTodos if needed (for older rooms)
  if (!room.userTodos) {
    room.userTodos = {};
  }

  // Create user's todo list if it doesn't exist
  if (!room.userTodos[userId]) {
    room.userTodos[userId] = {
      userId,
      userName,
      todos: [],
      activeTodoId: null,
      isPublic: true, // Default to public
    };
    await saveRoom(room);
  } else {
    // Update userName in case it changed
    room.userTodos[userId].userName = userName;
    await saveRoom(room);
  }

  return room.userTodos[userId];
}

export async function addTodo(
  roomId: string,
  userId: string,
  userName: string,
  text: string
): Promise<Record<string, UserTodos> | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  // Initialize if needed
  if (!room.userTodos) {
    room.userTodos = {};
  }
  if (!room.userTodos[userId]) {
    room.userTodos[userId] = {
      userId,
      userName,
      todos: [],
      activeTodoId: null,
      isPublic: true,
    };
  }

  const userTodos = room.userTodos[userId];
  
  // Check limit
  if (userTodos.todos.length >= MAX_TODOS_PER_USER) {
    return null;
  }

  const newTodo: TodoItem = {
    id: `${userId}-${Date.now()}`,
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
  };

  userTodos.todos.push(newTodo);
  userTodos.userName = userName; // Keep name updated
  
  await saveRoom(room);
  return room.userTodos;
}

export async function updateTodo(
  roomId: string,
  userId: string,
  todoId: string,
  updates: { text?: string; completed?: boolean }
): Promise<Record<string, UserTodos> | null> {
  const room = await getRoom(roomId);
  if (!room || !room.userTodos?.[userId]) return null;

  const userTodos = room.userTodos[userId];
  const todo = userTodos.todos.find(t => t.id === todoId);
  
  if (!todo) return null;

  if (updates.text !== undefined) {
    todo.text = updates.text.trim();
  }
  if (updates.completed !== undefined) {
    todo.completed = updates.completed;
  }

  await saveRoom(room);
  return room.userTodos;
}

export async function deleteTodo(
  roomId: string,
  userId: string,
  todoId: string
): Promise<Record<string, UserTodos> | null> {
  const room = await getRoom(roomId);
  if (!room || !room.userTodos?.[userId]) return null;

  const userTodos = room.userTodos[userId];
  userTodos.todos = userTodos.todos.filter(t => t.id !== todoId);
  
  // Clear active if it was deleted
  if (userTodos.activeTodoId === todoId) {
    userTodos.activeTodoId = null;
  }

  await saveRoom(room);
  return room.userTodos;
}

export async function setActiveTodo(
  roomId: string,
  userId: string,
  todoId: string | null
): Promise<Record<string, UserTodos> | null> {
  const room = await getRoom(roomId);
  if (!room || !room.userTodos?.[userId]) return null;

  room.userTodos[userId].activeTodoId = todoId;
  
  await saveRoom(room);
  return room.userTodos;
}

export async function setTodoVisibility(
  roomId: string,
  userId: string,
  isPublic: boolean,
  userName?: string
): Promise<Record<string, UserTodos> | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  // Initialize userTodos if needed
  if (!room.userTodos) {
    room.userTodos = {};
  }
  
  // Initialize user's todos if they don't exist
  if (!room.userTodos[userId]) {
    room.userTodos[userId] = {
      userId,
      userName: userName || "Anonymous",
      todos: [],
      activeTodoId: null,
      isPublic: isPublic,
    };
  } else {
    room.userTodos[userId].isPublic = isPublic;
  }
  
  await saveRoom(room);
  return room.userTodos;
}

