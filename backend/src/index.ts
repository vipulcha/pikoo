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

// CORS configuration - allow frontend URL and common patterns
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:3000",
  /\.vercel\.app$/,  // Allow all Vercel preview deployments
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => 
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now (MVP)
    }
  },
  credentials: true,
}));
app.use(express.json());

// Initialize Redis
initRedis();

// Socket.io setup with faster disconnect detection
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins for WebSocket (MVP)
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Faster disconnect detection (default is 20s + 25s = 45s!)
  pingTimeout: 10000,    // 10 seconds to wait for pong
  pingInterval: 5000,    // Ping every 5 seconds
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

// Debug endpoint to check connected sockets vs stored participants
app.get("/rooms/:roomId/debug", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoom(roomId);
    
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    
    // Get actually connected sockets in this room
    const socketsInRoom = await io.in(roomId).fetchSockets();
    const connectedSocketIds = socketsInRoom.map(s => s.id);
    
    // Find stale participants (in DB but not connected)
    const staleParticipants = room.participants.filter(
      p => !connectedSocketIds.includes(p.id)
    );
    
    res.json({
      roomId,
      storedParticipants: room.participants.map(p => ({
        id: p.id.slice(-6),
        name: p.name,
        uniqueId: p.uniqueId.slice(-8),
      })),
      connectedSockets: connectedSocketIds.map(id => id.slice(-6)),
      staleParticipants: staleParticipants.map(p => ({
        id: p.id.slice(-6),
        name: p.name,
      })),
    });
  } catch (err) {
    console.error("Error debugging room:", err);
    res.status(500).json({ error: "Failed to debug room" });
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

