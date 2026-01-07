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
  updateSettings,
} from "./store.js";

interface JoinRoomPayload {
  roomId: string;
}

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    let currentRoomId: string | null = null;

    // ========================================
    // Join Room
    // ========================================
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      const { roomId } = payload;
      
      try {
        let room = await getRoom(roomId);
        
        if (!room) {
          // Room doesn't exist - this is an error for joining
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found" });
          return;
        }

        // Join socket room
        socket.join(roomId);
        currentRoomId = roomId;

        // Add participant
        const participants = await addParticipant(roomId, socket.id);
        room = await getRoom(roomId);

        // Send current state to joining client
        socket.emit(SOCKET_EVENTS.ROOM_STATE, room);

        // Broadcast updated participants to all in room
        io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants });

        console.log(`👤 ${socket.id} joined room ${roomId}`);
      } catch (err) {
        console.error("Error joining room:", err);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to join room" });
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
          io.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
        }
      } catch (err) {
        console.error("Error updating settings:", err);
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

