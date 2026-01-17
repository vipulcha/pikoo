// ============================================
// Pikoo - WebSocket Gateway
// ============================================

import { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  RoomSettings,
  RoomState,
} from "./types.js";
import {
  getRoom,
  createRoom,
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

interface JoinRoomPayload {
  roomId: string;
  name: string;
  uniqueId: string;  // persistent user id from localStorage
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

// Helper to clean up stale participants (not actually connected)
async function cleanupStaleParticipants(io: Server, roomId: string): Promise<void> {
  try {
    const room = await getRoom(roomId);
    if (!room) return;

    const beforeCount = room.participants.length;
    const beforeParticipants = room.participants.map(p => `${p.name}(${p.id.slice(-6)})`);

    const socketsInRoom = await io.in(roomId).fetchSockets();
    const connectedSocketIds = new Set(socketsInRoom.map(s => s.id));

    // Double-check: Verify each participant's socket is actually disconnected before removing
    // This prevents race conditions where socket.join() hasn't fully propagated
    const verifiedStaleParticipants = room.participants.filter(p => {
      const isInRoom = connectedSocketIds.has(p.id);
      if (isInRoom) {
        // Socket is in room, definitely active
        return false;
      }

      // Socket not in room - verify it's actually disconnected
      // Check if socket exists in the namespace and is disconnected
      const socket = io.sockets.sockets.get(p.id);
      if (socket && socket.connected) {
        // Socket exists and is connected but not in room - might be a race condition
        // Don't remove it, it might be joining
        console.log(`[CLEANUP] WARNING: Participant ${p.name}(${p.id.slice(-6)}) socket is connected but not in room - skipping removal (race condition)`);
        return false;
      }

      // Socket doesn't exist or is disconnected - safe to remove
      return true;
    });

    // Always log cleanup attempt for debugging
    console.log(`[CLEANUP] Checking room ${roomId}: ${beforeCount} participants stored, ${connectedSocketIds.size} sockets connected`);
    console.log(`[CLEANUP] Stored participants:`, beforeParticipants);
    console.log(`[CLEANUP] Connected socket IDs:`, Array.from(connectedSocketIds).map(id => id.slice(-6)));

    if (verifiedStaleParticipants.length > 0) {
      console.log(`[CLEANUP] Found ${verifiedStaleParticipants.length} verified stale participants in ${roomId}:`,
        verifiedStaleParticipants.map(p => `${p.name}(${p.id.slice(-6)})`));

      // Only remove verified stale participants
      const staleSocketIds = new Set(verifiedStaleParticipants.map(p => p.id));
      room.participants = room.participants.filter(p => !staleSocketIds.has(p.id));

      const { saveRoom } = await import("./store.js");
      await saveRoom(room);

      // Broadcast updated participants
      io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants: room.participants });
      console.log(`[CLEANUP] Removed stale participants, now ${room.participants.length} remaining`);
    } else {
      console.log(`[CLEANUP] No stale participants found in ${roomId}`);
    }
  } catch (err) {
    console.error("[CLEANUP] Error cleaning up stale participants:", err);
  }
}

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    let currentRoomId: string | null = null;
    let currentUserName: string = "Anonymous";
    let currentUniqueId: string = "";

    // ========================================
    // Join Room
    // ========================================
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      const { roomId, name, uniqueId } = payload;

      try {
        let room = await getRoom(roomId);

        if (!room) {
          // Room doesn't exist - this is an error for joining
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
          return;
        }

        // Try to add participant (validates name uniqueness)
        const result = await addParticipant(roomId, socket.id, uniqueId, name || "Anonymous");

        if (!result.success) {
          // Name is taken by another user
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: result.error || "Failed to join room",
            code: "NAME_TAKEN"
          });
          return;
        }

        // Join socket room
        socket.join(roomId);
        currentRoomId = roomId;
        currentUserName = name || "Anonymous";
        currentUniqueId = uniqueId;

        // Ensure user has a todo list entry
        await ensureUserTodos(roomId, uniqueId, currentUserName);

        room = await getRoom(roomId);

        // Clean up any stale participants before sending state
        await cleanupStaleParticipants(io, roomId);

        // Re-fetch room after cleanup
        room = await getRoom(roomId);

        // Send current state to joining client
        console.log(`[JOIN_ROOM] Sending ROOM_STATE to ${socket.id}, userTodos for ${uniqueId}:`, room?.userTodos?.[uniqueId]?.todos?.length || 0);
        socket.emit(SOCKET_EVENTS.ROOM_STATE, room);

        // Broadcast updated participants to all in room
        if (name && name !== "Anonymous") {
          // If user has a name, they generated a "join" activity log
          // So we must broadcast the full ROOM_STATE to update history for everyone
          io.to(roomId).emit(SOCKET_EVENTS.ROOM_STATE, room);
        } else {
          // Anonymous users don't generate activity logs, so just update participants list
          io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants: room?.participants || [] });
        }

        console.log(`👤 ${name || "Anonymous"} (${socket.id}) joined room ${roomId}`);
      } catch (err) {
        console.error("Error joining room:", err);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to join room" });
      }
    });

    // ========================================
    // Update Name (without reconnecting)
    // ========================================
    socket.on(SOCKET_EVENTS.UPDATE_NAME, async (payload: UpdateNamePayload) => {
      console.log(`[UPDATE_NAME] Received from ${socket.id}, currentRoomId=${currentRoomId}, currentUniqueId=${currentUniqueId}`);
      if (!currentRoomId || !currentUniqueId) {
        console.log("[UPDATE_NAME] Missing roomId or uniqueId, ignoring");
        return;
      }

      const { name } = payload;
      console.log(`[UPDATE_NAME] New name: "${name}"`);
      if (!name || name.trim().length === 0) return;

      try {
        const result = await updateParticipantName(
          currentRoomId,
          socket.id,
          currentUniqueId,
          name.trim()
        );

        if (!result.success) {
          console.log(`[UPDATE_NAME] Failed: ${result.error}`);
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: result.error || "Failed to update name",
            code: "NAME_TAKEN"
          });
          return;
        }

        // Check if we need to log a "join" activity (if unmasking from Anonymous)
        // We must check this BEFORE updating currentUserName to the new name
        if (currentUserName === "Anonymous" && name.trim() !== "Anonymous") {
          await addActivity(currentRoomId, "join", currentUniqueId, name.trim());
          // Broadcast update for history - Must refetch to get the new activity log!
          const updatedRoomWithHistory = await getRoom(currentRoomId);
          if (updatedRoomWithHistory) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoomWithHistory);
          }
        }

        // Update local state
        currentUserName = name.trim();

        // Broadcast updated participants to all in room
        io.to(currentRoomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, {
          participants: result.participants
        });

        // Also broadcast updated todos (since userName changed there too)
        const room = await getRoom(currentRoomId);
        if (room) {
          console.log(`[UPDATE_NAME] Broadcasting TODOS_UPDATE, todos for ${currentUniqueId}:`, room.userTodos[currentUniqueId]?.todos?.length || 0);
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, {
            userTodos: room.userTodos
          });
        }

        console.log(`📝 ${socket.id} changed name to "${name.trim()}" in room ${currentRoomId}`);
      } catch (err) {
        console.error("Error updating name:", err);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to update name" });
      }
    });

    // ========================================
    // Timer Controls
    // ========================================
    socket.on(SOCKET_EVENTS.TIMER_START, async (payload?: { timestamp?: number }) => {
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        // Check permissions
        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await startTimer(currentRoomId, socket.id, currentUserName, payload?.timestamp);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          // Also broadcast history update since we logged it
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          }
        }
      } catch (err) {
        console.error("Error starting timer:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_PAUSE, async (payload?: { timestamp?: number }) => {
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
          // Also broadcast history update
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          }
        }
      } catch (err) {
        console.error("Error pausing timer:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_RESET, async (payload?: { timestamp?: number }) => {
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
          // Also broadcast history update
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          }
        }
      } catch (err) {
        console.error("Error resetting timer:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_SKIP, async (payload?: { source?: "auto" | "manual", timestamp?: number }) => {
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
          console.log(
            `[AUTO_SKIP] Ignoring auto-skip request - timer not finished or not running (phase=${room.timer.phase}, running=${room.timer.running}, remainingMs=${remainingMs ?? "n/a"})`
          );
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
            // Also broadcast history update
            const updatedRoom = await getRoom(currentRoomId);
            if (updatedRoom) {
              io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
            }
          }
        }
      } catch (err) {
        console.error("Error skipping phase:", err);
      }
    });

    // ========================================
    // Settings Update
    // ========================================
    socket.on(SOCKET_EVENTS.UPDATE_SETTINGS, async (payload: Partial<RoomSettings> & { timestamp?: number }) => {
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can change settings" });
          return;
        }

        const settings = await updateSettings(currentRoomId, payload, payload.timestamp);
        if (settings) {
          const updatedRoom = await getRoom(currentRoomId);
          // Send full room state so timer gets updated too
          io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
          // Also send timer update explicitly
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer: updatedRoom?.timer });
        }
      } catch (err) {
        console.error("Error updating settings:", err);
      }
    });

    // ========================================
    // Chat Messages
    // ========================================
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (payload: SendMessagePayload) => {
      if (!currentRoomId) return;

      try {
        const { text } = payload;

        // Validate message
        if (!text || text.trim().length === 0) return;
        if (text.length > 500) return; // Max 500 chars

        const message: ChatMessage = {
          id: `${socket.id}-${Date.now()}`,
          senderId: socket.id,
          senderName: currentUserName,
          text: text.trim(),
          timestamp: Date.now(),
        };

        const savedMessage = await addMessage(currentRoomId, message);
        if (savedMessage) {
          // Broadcast to all in room including sender
          io.to(currentRoomId).emit(SOCKET_EVENTS.NEW_MESSAGE, { message: savedMessage });
        }
      } catch (err) {
        console.error("Error sending message:", err);
      }
    });

    // ========================================
    // Todo Operations
    // ========================================
    socket.on(SOCKET_EVENTS.TODO_ADD, async (payload: TodoAddPayload) => {
      console.log(`[TODO_ADD] Received from ${socket.id}, currentRoomId=${currentRoomId}, currentUniqueId=${currentUniqueId}`);
      if (!currentRoomId || !currentUniqueId) {
        console.log("[TODO_ADD] Missing roomId or uniqueId, ignoring");
        return;
      }

      try {
        const { text } = payload;
        console.log(`[TODO_ADD] Adding todo: "${text}" for user ${currentUserName}`);
        if (!text || text.trim().length === 0) return;
        if (text.length > 200) return; // Max 200 chars per todo

        const userTodos = await addTodo(currentRoomId, currentUniqueId, currentUserName, text);
        if (userTodos) {
          console.log(`[TODO_ADD] Broadcasting TODOS_UPDATE, todos count for ${currentUniqueId}:`, userTodos[currentUniqueId]?.todos?.length);
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        } else {
          console.log("[TODO_ADD] addTodo returned null");
        }
      } catch (err) {
        console.error("Error adding todo:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TODO_UPDATE, async (payload: TodoUpdatePayload) => {
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const { todoId, text, completed } = payload;
        if (!todoId) return;

        const userTodos = await updateTodo(currentRoomId, currentUniqueId, todoId, { text, completed });
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        console.error("Error updating todo:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TODO_DELETE, async (payload: TodoDeletePayload) => {
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const { todoId } = payload;
        if (!todoId) return;

        const userTodos = await deleteTodo(currentRoomId, currentUniqueId, todoId);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        console.error("Error deleting todo:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TODO_SET_ACTIVE, async (payload: TodoSetActivePayload) => {
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const { todoId } = payload;

        const userTodos = await setActiveTodo(currentRoomId, currentUniqueId, todoId);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        console.error("Error setting active todo:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TODO_SET_VISIBILITY, async (payload: TodoSetVisibilityPayload) => {
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const { isPublic } = payload;

        const userTodos = await setTodoVisibility(currentRoomId, currentUniqueId, isPublic, currentUserName);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        console.error("Error setting todo visibility:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TODO_REORDER, async (payload: TodoReorderPayload) => {
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const { todoIds } = payload;
        if (!Array.isArray(todoIds)) return;

        const userTodos = await reorderTodos(currentRoomId, currentUniqueId, todoIds);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
        }
      } catch (err) {
        console.error("Error reordering todos:", err);
      }
    });

    // ========================================
    // Disconnect
    // ========================================
    socket.on("disconnect", async (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}, roomId: ${currentRoomId}, user: ${currentUserName}, uniqueId: ${currentUniqueId}`);

      if (currentRoomId) {
        try {
          // Get room state before removal for debugging
          const roomBefore = await getRoom(currentRoomId);
          const participantsBefore = roomBefore?.participants || [];
          console.log(`[DISCONNECT] Before removal - room has ${participantsBefore.length} participants:`,
            participantsBefore.map(p => `${p.name}(${p.id.slice(-6)}, uniqueId: ${p.uniqueId.slice(-8)})`));

          console.log(`[DISCONNECT] Removing participant ${socket.id} (${currentUserName}) from room ${currentRoomId}`);
          const participants = await removeParticipant(currentRoomId, socket.id);
          console.log(`[DISCONNECT] After removal, ${participants.length} participants remaining:`,
            participants.map(p => `${p.name}(${p.id.slice(-6)})`));
          io.to(currentRoomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants });

          // Log "leave" activity (we do this here because we have the user info)
          if (participants.length < participantsBefore.length) {
            await addActivity(currentRoomId, "leave", currentUniqueId, currentUserName);
            // Broadcast room state to update history
            const updatedRoom = await getRoom(currentRoomId);
            if (updatedRoom) {
              io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
            }
          }
        } catch (err) {
          console.error("[DISCONNECT] Error removing participant:", err);
        }
      } else {
        console.log(`[DISCONNECT] No room to leave for ${socket.id} (${currentUserName})`);
      }
    });
  });
}
