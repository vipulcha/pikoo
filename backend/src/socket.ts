import { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  RoomSettings,
  RoomState,
} from "./types.js";
import {
  getRoom,
  createRoom,
  saveRoom,
  startTimer,
  pauseTimer,
  resetTimer,
  skipPhase,
  addParticipant,
  removeParticipant,
  updateParticipantName,
  updateSettings,
  addMessage,
  ensureUserTodos,
  addTodo,
  updateTodo,
  deleteTodo,
  setActiveTodo,
  setTodoVisibility,
  reorderTodos,
  addActivity,
} from "./store.js";
import { ChatMessage, UserTodos } from "./types.js";
import { log } from "./logger.js";
import { socketEventLimiter, chatMessageLimiter } from "./rate-limit.js";
import {
  sanitizeName,
  sanitizeMessage,
  sanitizeTodoText,
  sanitizeRoomId,
  sanitizeUniqueId,
  isValidTodoId,
  isValidBoolean,
  sanitizeSettings,
} from "./sanitize.js";

interface JoinRoomPayload {
  roomId: string;
  name: string;
  uniqueId: string;
}

interface SendMessagePayload {
  text: string;
}

interface TodoAddPayload {
  text: string;
}

interface TodoUpdatePayload {
  todoId: string;
  text?: string;
  completed?: boolean;
}

interface TodoDeletePayload {
  todoId: string;
}

interface TodoSetActivePayload {
  todoId: string | null;
}

interface TodoSetVisibilityPayload {
  isPublic: boolean;
}

interface TodoReorderPayload {
  todoIds: string[];
}

interface UpdateNamePayload {
  name: string;
}

// Rate-limit guard — returns true if blocked
function rateLimited(socket: Socket, label?: string): boolean {
  if (!socketEventLimiter.consume(socket.id)) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: "Too many requests, slow down" });
    return true;
  }
  return false;
}

async function cleanupStaleParticipants(io: Server, roomId: string): Promise<void> {
  try {
    const room = await getRoom(roomId);
    if (!room) return;

    const socketsInRoom = await io.in(roomId).fetchSockets();
    const connectedSocketIds = new Set(socketsInRoom.map(s => s.id));

    const verifiedStaleParticipants = room.participants.filter(p => {
      if (connectedSocketIds.has(p.id)) return false;
      const socket = io.sockets.sockets.get(p.id);
      if (socket && socket.connected) {
        log.socket.debug("Skipping removal — socket connected but not in room (race)", { socketId: p.id.slice(-6), name: p.name });
        return false;
      }
      return true;
    });

    if (verifiedStaleParticipants.length > 0) {
      log.socket.info("Removing stale participants", {
        roomId,
        count: verifiedStaleParticipants.length,
        names: verifiedStaleParticipants.map(p => p.name),
      });

      const staleSocketIds = new Set(verifiedStaleParticipants.map(p => p.id));
      room.participants = room.participants.filter(p => !staleSocketIds.has(p.id));
      await saveRoom(room);
      io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants: room.participants });
    }
  } catch (err) {
    log.socket.error("Cleanup error", { error: String(err) });
  }
}

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    log.socket.info("Client connected", { socketId: socket.id.slice(-6) });

    let currentRoomId: string | null = null;
    let currentUserName: string = "Anonymous";
    let currentUniqueId: string = "";

    // ========================================
    // Join Room
    // ========================================
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      if (rateLimited(socket)) return;

      const roomId = sanitizeRoomId(payload?.roomId);
      const name = sanitizeName(payload?.name) || "Anonymous";
      const uniqueId = sanitizeUniqueId(payload?.uniqueId);

      if (!roomId || !uniqueId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid room ID or user ID" });
        return;
      }

      try {
        let room = await getRoom(roomId);

        if (!room) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
          return;
        }

        const result = await addParticipant(roomId, socket.id, uniqueId, name);

        if (!result.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: result.error || "Failed to join room",
            code: "NAME_TAKEN"
          });
          return;
        }

        socket.join(roomId);
        currentRoomId = roomId;
        currentUserName = name;
        currentUniqueId = uniqueId;

        await ensureUserTodos(roomId, uniqueId, currentUserName);
        await cleanupStaleParticipants(io, roomId);
        room = await getRoom(roomId);

        socket.emit(SOCKET_EVENTS.ROOM_STATE, room);

        if (name !== "Anonymous") {
          io.to(roomId).emit(SOCKET_EVENTS.ROOM_STATE, room);
        } else {
          io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants: room?.participants || [] });
        }

        log.socket.info("User joined room", { roomId, name, socketId: socket.id.slice(-6) });
      } catch (err) {
        log.socket.error("Join room error", { error: String(err), roomId });
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to join room" });
      }
    });

    // ========================================
    // Update Name
    // ========================================
    socket.on(SOCKET_EVENTS.UPDATE_NAME, async (payload: UpdateNamePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      const name = sanitizeName(payload?.name);
      if (!name) return;

      try {
        const result = await updateParticipantName(
          currentRoomId,
          socket.id,
          currentUniqueId,
          name
        );

        if (!result.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: result.error || "Failed to update name",
            code: "NAME_TAKEN"
          });
          return;
        }

        if (currentUserName === "Anonymous" && name !== "Anonymous") {
          await addActivity(currentRoomId, "join", currentUniqueId, name);
          const updatedRoomWithHistory = await getRoom(currentRoomId);
          if (updatedRoomWithHistory) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoomWithHistory);
          }
        }

        currentUserName = name;

        io.to(currentRoomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, {
          participants: result.participants
        });

        const room = await getRoom(currentRoomId);
        if (room) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, {
            userTodos: room.userTodos
          });
        }

        log.socket.info("Name updated", { socketId: socket.id.slice(-6), newName: name });
      } catch (err) {
        log.socket.error("Update name error", { error: String(err) });
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to update name" });
      }
    });

    // ========================================
    // Timer Controls
    // ========================================
    socket.on(SOCKET_EVENTS.TIMER_START, async (payload?: { timestamp?: number }) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await startTimer(currentRoomId, socket.id, currentUserName, payload?.timestamp);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          }
        }
      } catch (err) {
        log.socket.error("Timer start error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_PAUSE, async (payload?: { timestamp?: number }) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await pauseTimer(currentRoomId, socket.id, currentUserName, payload?.timestamp);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          }
        }
      } catch (err) {
        log.socket.error("Timer pause error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_RESET, async (payload?: { timestamp?: number }) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await resetTimer(currentRoomId, socket.id, currentUserName, payload?.timestamp);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          }
        }
      } catch (err) {
        log.socket.error("Timer reset error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_SKIP, async (payload?: { source?: "auto" | "manual", timestamp?: number }) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const source = payload?.source || "manual";
        const phaseEndsAt = room.timer.phaseEndsAt;
        const now = Date.now();
        const remainingMs = phaseEndsAt ? phaseEndsAt - now : null;
        const AUTO_SKIP_GRACE_MS = 2000;

        if (
          source === "auto" &&
          (!room.timer.running || !phaseEndsAt || (remainingMs !== null && remainingMs > AUTO_SKIP_GRACE_MS))
        ) {
          return;
        }

        const timer = await skipPhase(
          currentRoomId,
          socket.id,
          currentUserName,
          source === "auto"
            ? {
              expectedPhase: room.timer.phase,
              expectedPhaseEndsAt: room.timer.phaseEndsAt,
              expectedRunning: room.timer.running,
            }
            : undefined,
          payload?.timestamp
        );
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          if (source === "manual") {
            const updatedRoom = await getRoom(currentRoomId);
            if (updatedRoom) {
              io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
            }
          }
        }
      } catch (err) {
        log.socket.error("Timer skip error", { error: String(err) });
      }
    });

    // ========================================
    // Settings Update
    // ========================================
    socket.on(SOCKET_EVENTS.UPDATE_SETTINGS, async (payload: Partial<RoomSettings> & { timestamp?: number }) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can change settings" });
          return;
        }

        const cleanSettings = sanitizeSettings(payload);
        if (!cleanSettings) return;

        const settings = await updateSettings(currentRoomId, cleanSettings as Partial<RoomSettings>, payload.timestamp);
        if (settings) {
          const updatedRoom = await getRoom(currentRoomId);
          io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer: updatedRoom?.timer });
        }
      } catch (err) {
        log.socket.error("Settings update error", { error: String(err) });
      }
    });

    // ========================================
    // Chat Messages
    // ========================================
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (payload: SendMessagePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      if (!chatMessageLimiter.consume(socket.id)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Sending messages too fast" });
        return;
      }

      try {
        const text = sanitizeMessage(payload?.text);
        if (!text) return;

        const message: ChatMessage = {
          id: `${socket.id}-${Date.now()}`,
          senderId: socket.id,
          senderName: currentUserName,
          text,
          timestamp: Date.now(),
        };

        const savedMessage = await addMessage(currentRoomId, message);
        if (savedMessage) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.NEW_MESSAGE, { message: savedMessage });
        }
      } catch (err) {
        log.socket.error("Send message error", { error: String(err) });
      }
    });

    // ========================================
    // Todo Operations
    // ========================================
    socket.on(SOCKET_EVENTS.TODO_ADD, async (payload: TodoAddPayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const text = sanitizeTodoText(payload?.text);
        if (!text) return;

        const userTodos = await addTodo(currentRoomId, currentUniqueId, currentUserName, text);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        log.socket.error("Todo add error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TODO_UPDATE, async (payload: TodoUpdatePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        if (!isValidTodoId(payload?.todoId)) return;

        const updates: { text?: string; completed?: boolean } = {};
        if (payload.text !== undefined) {
          const cleanText = sanitizeTodoText(payload.text);
          if (cleanText) updates.text = cleanText;
        }
        if (isValidBoolean(payload.completed)) {
          updates.completed = payload.completed;
        }
        if (Object.keys(updates).length === 0) return;

        const userTodos = await updateTodo(currentRoomId, currentUniqueId, payload.todoId, updates);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        log.socket.error("Todo update error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TODO_DELETE, async (payload: TodoDeletePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        if (!isValidTodoId(payload?.todoId)) return;

        const userTodos = await deleteTodo(currentRoomId, currentUniqueId, payload.todoId);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        log.socket.error("Todo delete error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TODO_SET_ACTIVE, async (payload: TodoSetActivePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const todoId = payload?.todoId;
        if (todoId !== null && !isValidTodoId(todoId)) return;

        const userTodos = await setActiveTodo(currentRoomId, currentUniqueId, todoId);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        log.socket.error("Todo set active error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TODO_SET_VISIBILITY, async (payload: TodoSetVisibilityPayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        if (!isValidBoolean(payload?.isPublic)) return;

        const userTodos = await setTodoVisibility(currentRoomId, currentUniqueId, payload.isPublic, currentUserName);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        log.socket.error("Todo visibility error", { error: String(err) });
      }
    });

    socket.on(SOCKET_EVENTS.TODO_REORDER, async (payload: TodoReorderPayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const todoIds = payload?.todoIds;
        if (!Array.isArray(todoIds) || todoIds.length > 100) return;
        if (!todoIds.every(id => typeof id === "string" && id.length < 100)) return;

        const userTodos = await reorderTodos(currentRoomId, currentUniqueId, todoIds);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        log.socket.error("Todo reorder error", { error: String(err) });
      }
    });

    // ========================================
    // Disconnect
    // ========================================
    socket.on("disconnect", async (reason) => {
      log.socket.info("Client disconnected", {
        socketId: socket.id.slice(-6),
        reason,
        roomId: currentRoomId,
        user: currentUserName,
      });

      if (currentRoomId) {
        try {
          const roomBefore = await getRoom(currentRoomId);
          const countBefore = roomBefore?.participants.length || 0;

          const participants = await removeParticipant(currentRoomId, socket.id);
          io.to(currentRoomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants });

          if (participants.length < countBefore) {
            await addActivity(currentRoomId, "leave", currentUniqueId, currentUserName);
            const updatedRoom = await getRoom(currentRoomId);
            if (updatedRoom) {
              io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
            }
          }
        } catch (err) {
          log.socket.error("Disconnect cleanup error", { error: String(err) });
        }
      }
    });
  });
}
