// ============================================
// Pikoo - Main Server Entry Point
// ============================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { nanoid } from "nanoid";
import dotenv from "dotenv";

import { initRedis, createRoom, getRoom } from "./store.js";
import { setupSocketHandlers } from "./socket.js";
import { RoomSettings, DEFAULT_SETTINGS } from "./types.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

// Initialize Redis
initRedis();

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setupSocketHandlers(io);

// ============================================
// REST API Routes
// ============================================

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Create a new room
app.post("/rooms", async (req, res) => {
  try {
    const { settings } = req.body as { settings?: Partial<RoomSettings> };
    const roomId = nanoid(10); // Short, URL-friendly ID
    
    const room = await createRoom(roomId, settings || {});
    
    console.log(`🏠 Room created: ${roomId}`);
    res.status(201).json({ roomId, room });
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Get room state (for hydration/fallback)
app.get("/rooms/:roomId/state", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoom(roomId);
    
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    
    res.json(room);
  } catch (err) {
    console.error("Error getting room:", err);
    res.status(500).json({ error: "Failed to get room state" });
  }
});

// ============================================
// Start Server
// ============================================

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🍅 Pikoo Server Running                         ║
║                                                   ║
║   REST API:    http://localhost:${PORT}             ║
║   WebSocket:   ws://localhost:${PORT}               ║
║   Frontend:    ${FRONTEND_URL}              ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

