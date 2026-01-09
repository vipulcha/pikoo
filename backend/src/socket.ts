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

interface UpdateNamePayload {
  name: string;
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

        // Send current state to joining client
        socket.emit(SOCKET_EVENTS.ROOM_STATE, room);

        // Broadcast updated participants to all in room
        io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants: result.participants });

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
      if (!currentRoomId || !currentUniqueId) return;
      
      const { name } = payload;
      if (!name || name.trim().length === 0) return;
      
      try {
        const result = await updateParticipantName(
          currentRoomId,
          socket.id,
          currentUniqueId,
          name.trim()
        );
        
        if (!result.success) {
          socket.emit(SOCKET_EVENTS.ERROR, { 
            message: result.error || "Failed to update name",
            code: "NAME_TAKEN"
          });
          return;
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
    socket.on(SOCKET_EVENTS.TIMER_START, async () => {
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        // Check permissions
        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await startTimer(currentRoomId);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
        }
      } catch (err) {
        console.error("Error starting timer:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_PAUSE, async () => {
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await pauseTimer(currentRoomId);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
        }
      } catch (err) {
        console.error("Error pausing timer:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_RESET, async () => {
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await resetTimer(currentRoomId);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
        }
      } catch (err) {
        console.error("Error resetting timer:", err);
      }
    });

    socket.on(SOCKET_EVENTS.TIMER_SKIP, async () => {
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await skipPhase(currentRoomId);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
        }
      } catch (err) {
        console.error("Error skipping phase:", err);
      }
    });

    // ========================================
    // Settings Update
    // ========================================
    socket.on(SOCKET_EVENTS.UPDATE_SETTINGS, async (payload: Partial<RoomSettings>) => {
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (room.settings.mode === "host" && room.hostId !== socket.id) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can change settings" });
          return;
        }

        const settings = await updateSettings(currentRoomId, payload);
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
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const { text } = payload;
        if (!text || text.trim().length === 0) return;
        if (text.length > 200) return; // Max 200 chars per todo

        const userTodos = await addTodo(currentRoomId, currentUniqueId, currentUserName, text);
        if (userTodos) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos });
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

    // ========================================
    // Disconnect
    // ========================================
    socket.on("disconnect", async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      if (currentRoomId) {
        try {
          const participants = await removeParticipant(currentRoomId, socket.id);
          io.to(currentRoomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants });
        } catch (err) {
          console.error("Error removing participant:", err);
        }
      }
    });
  });
}

