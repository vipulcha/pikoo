import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { nanoid } from "nanoid";
import dotenv from "dotenv";

import { initRedis, createRoom, getRoom, addSuggestion, getSuggestions } from "./store.js";
import { setupSocketHandlers } from "./socket.js";
import { RoomSettings, DEFAULT_SETTINGS } from "./types.js";
import { log } from "./logger.js";
import { roomCreateLimiter, restGetLimiter, connectionLimiter, suggestionLimiter } from "./rate-limit.js";
import { sanitizeSettings, sanitizeSuggestion, sanitizeName, sanitizeRoomId } from "./sanitize.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";
const DEBUG_SECRET = process.env.DEBUG_SECRET || "";

// ============================================
// Security middleware
// ============================================
app.use(helmet());

// CORS — in production, only allow the configured frontend origin + Vercel previews
const allowedOrigins: (string | RegExp)[] = [
  FRONTEND_URL,
  "http://localhost:3000",
  /\.vercel\.app$/,
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowed =>
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
    if (isAllowed) {
      callback(null, true);
    } else if (!IS_PROD) {
      callback(null, true);
    } else {
      log.security.warn("CORS blocked", { origin });
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "16kb" }));

// Trust proxy so we get real IPs behind reverse proxies (Railway, Render, etc.)
app.set("trust proxy", 1);

// ============================================
// Redis
// ============================================
initRedis();

// ============================================
// Socket.IO
// ============================================
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some(allowed =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
      );
      if (isAllowed || !IS_PROD) {
        callback(null, true);
      } else {
        log.security.warn("WebSocket CORS blocked", { origin });
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 10000,
  pingInterval: 5000,
  maxHttpBufferSize: 1e5, // 100KB max per message (prevents payload abuse)
});

// Connection-level rate limiting
io.use((socket, next) => {
  const ip = socket.handshake.address;
  if (!connectionLimiter.consume(ip)) {
    log.security.warn("Connection rate limited", { ip: ip.slice(-12) });
    return next(new Error("Too many connections, please try again later"));
  }
  next();
});

setupSocketHandlers(io);

// ============================================
// Metrics tracking (in-memory, lightweight)
// ============================================
const metrics = {
  roomsCreated: 0,
  httpRequests: 0,
  startedAt: Date.now(),
};

app.use((req, _res, next) => {
  metrics.httpRequests++;
  next();
});

// ============================================
// Helper: get client IP from request
// ============================================
function getIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

// ============================================
// REST API Routes
// ============================================

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.post("/rooms", async (req, res) => {
  const ip = getIp(req);

  if (!roomCreateLimiter.consume(ip)) {
    log.security.warn("Room creation rate limited", { ip: ip.slice(-12) });
    res.status(429).json({ error: "Too many rooms created, please wait" });
    return;
  }

  try {
    const rawSettings = req.body?.settings;
    const settings = rawSettings ? sanitizeSettings(rawSettings) : {};
    const roomId = nanoid(10);
    const room = await createRoom(roomId, (settings || {}) as Partial<RoomSettings>);

    metrics.roomsCreated++;
    log.server.info("Room created", { roomId });
    res.status(201).json({ roomId, room });
  } catch (err) {
    log.server.error("Failed to create room", { error: String(err) });
    res.status(500).json({ error: "Failed to create room" });
  }
});

app.get("/rooms/:roomId/state", async (req, res) => {
  const ip = getIp(req);

  if (!restGetLimiter.consume(ip)) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  try {
    const { roomId } = req.params;
    const room = await getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
  } catch (err) {
    log.server.error("Failed to get room state", { error: String(err) });
    res.status(500).json({ error: "Failed to get room state" });
  }
});

app.post("/suggestions", async (req, res) => {
  const ip = getIp(req);

  if (!suggestionLimiter.consume(ip)) {
    res.status(429).json({ error: "Too many suggestions, please wait a bit" });
    return;
  }

  const text = sanitizeSuggestion(req.body?.text);
  if (!text) {
    res.status(400).json({ error: "Suggestion cannot be empty" });
    return;
  }

  try {
    await addSuggestion({
      text,
      name: sanitizeName(req.body?.name) ?? undefined,
      roomId: sanitizeRoomId(req.body?.roomId) ?? undefined,
      createdAt: Date.now(),
    });
    log.server.info("Suggestion received", { length: text.length });
    res.status(201).json({ ok: true });
  } catch (err) {
    log.server.error("Failed to save suggestion", { error: String(err) });
    res.status(500).json({ error: "Failed to save suggestion" });
  }
});

// Read suggestions — gated behind DEBUG_SECRET in production
app.get("/suggestions", async (req, res) => {
  if (IS_PROD) {
    const token = req.query.token;
    if (!DEBUG_SECRET || token !== DEBUG_SECRET) {
      return res.status(404).json({ error: "Not found" });
    }
  }

  try {
    res.json(await getSuggestions());
  } catch (err) {
    log.server.error("Failed to get suggestions", { error: String(err) });
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

// Debug endpoint — gated behind DEBUG_SECRET in production
app.get("/rooms/:roomId/debug", async (req, res) => {
  if (IS_PROD) {
    const token = req.query.token;
    if (!DEBUG_SECRET || token !== DEBUG_SECRET) {
      return res.status(404).json({ error: "Not found" });
    }
  }

  try {
    const { roomId } = req.params;
    const room = await getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const socketsInRoom = await io.in(roomId).fetchSockets();
    const connectedSocketIds = socketsInRoom.map(s => s.id);
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
    log.server.error("Debug endpoint error", { error: String(err) });
    res.status(500).json({ error: "Failed to debug room" });
  }
});

// Lightweight metrics endpoint (also gated in production)
app.get("/metrics", (req, res) => {
  if (IS_PROD) {
    const token = req.query.token;
    if (!DEBUG_SECRET || token !== DEBUG_SECRET) {
      return res.status(404).json({ error: "Not found" });
    }
  }

  const connectedSockets = io.engine.clientsCount;
  const uptimeSec = Math.floor((Date.now() - metrics.startedAt) / 1000);

  res.json({
    uptime_seconds: uptimeSec,
    connected_sockets: connectedSockets,
    rooms_created_total: metrics.roomsCreated,
    http_requests_total: metrics.httpRequests,
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

// ============================================
// Start Server
// ============================================

httpServer.listen(PORT, () => {
  log.server.info("Pikoo server started", {
    port: PORT,
    frontend: FRONTEND_URL,
    env: IS_PROD ? "production" : "development",
  });
});
