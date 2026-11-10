import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { nanoid } from "nanoid";
import dotenv from "dotenv";

import { initRedis, createRoom, getRoom, addSuggestion, getSuggestions } from "./store.js";
import { track, readDailyStats, readTotals, logVisitor } from "./stats.js";
import { LIBRARY_ROOMS, libraryCount } from "./library.js";
import { setupSocketHandlers } from "./socket.js";
import { RoomSettings, DEFAULT_SETTINGS } from "./types.js";
import { log } from "./logger.js";
import { roomCreateLimiter, restGetLimiter, connectionLimiter, suggestionLimiter } from "./rate-limit.js";
import { roomForUser } from "./views.js";
import { sanitizeSettings, sanitizeSuggestion, sanitizeName, sanitizeRoomId, sanitizeUniqueId, sanitizeRoomSlug } from "./sanitize.js";

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
    const creatorId = sanitizeUniqueId(req.body?.creatorId);
    const slug = sanitizeRoomSlug(req.body?.slug);
    if (slug && "error" in slug) {
      res.status(400).json({ error: slug.error });
      return;
    }
    const roomId = slug ? slug.slug : nanoid(10);
    const room = await createRoom(roomId, (settings || {}) as Partial<RoomSettings>, creatorId, { exclusive: true });
    if (!room) {
      res.status(409).json({ error: slug ? "That link is already taken, try another" : "Please try again" });
      return;
    }

    metrics.roomsCreated++;
    track("rooms_created", creatorId || undefined);
    log.server.info("Room created", { roomId });
    logVisitor(creatorId || undefined, `🏠 created room ${roomId}${slug ? " (custom link)" : ""} ${JSON.stringify(settings ?? {}).slice(0, 120)}`);
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
    res.json(roomForUser(room, undefined));
  } catch (err) {
    log.server.error("Failed to get room state", { error: String(err) });
    res.status(500).json({ error: "Failed to get room state" });
  }
});

// Public: the minimum needed to render a link preview for a room (no names, chat or goals)
app.get("/rooms/:roomId/preview", async (req, res) => {
  const ip = getIp(req);

  if (!restGetLimiter.consume(ip)) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  try {
    const room = await getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const people = new Set<string>();
    for (const s of await io.in(room.id).fetchSockets()) {
      if (s.data.uniqueId) people.add(s.data.uniqueId);
    }
    res.set("Cache-Control", "public, max-age=30");
    res.json({
      peopleFocusing: people.size,
      phase: room.timer.phase,
      running: room.timer.running,
      focusMin: Math.round(room.settings.focusSec / 60),
      breakMin: Math.round(room.settings.breakSec / 60),
      cycleCount: room.timer.cycleCount,
      schedule: room.schedule ?? null,
    });
  } catch (err) {
    log.server.error("Failed to get room preview", { error: String(err) });
    res.status(500).json({ error: "Failed to get room preview" });
  }
});

// Public: the silent library rooms and how many people are in each
app.get("/library", async (req, res) => {
  const ip = getIp(req);
  if (!restGetLimiter.consume(ip)) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  const rooms = await Promise.all(LIBRARY_ROOMS.map(async (r) => ({ ...r, count: await libraryCount(io, r.id) })));
  res.set("Cache-Control", "public, max-age=15");
  res.json({ rooms });
});

// Public: number of distinct people currently in a room (shown on the landing page)
app.get("/stats", async (req, res) => {
  const ip = getIp(req);

  if (!restGetLimiter.consume(ip)) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const people = new Set<string>();
  for (const socket of io.of("/").sockets.values()) {
    if (socket.data.uniqueId) people.add(socket.data.uniqueId);
  }
  try {
    res.json({ focusingNow: people.size, totals: await readTotals() });
  } catch {
    res.json({ focusingNow: people.size });
  }
});

// Visitor trace from the browser: page views and clicks that never reach a socket.
// Only known event names, short string props; the text/plain body avoids a CORS
// preflight so the browser can fire it on page exit.
const TRACE_EVENTS: Record<string, string> = {
  page: "👀 opened", leave_page: "👋 left", click: "🖱️ clicked", music: "🎧 picked music",
  share: "📤 shared", join_form: "🔗 tried to join with a link", create_room: "🏠 tried to create a room",
  solo_timer: "⏱️ solo timer", obs: "🎥 OBS builder", intro: "📖 silent-room intro", hint: "💡 music hint", error: "⚠️ saw an error",
};
const traceLimiter = new Map<string, { n: number; at: number }>();

app.post("/events", express.text({ type: "*/*", limit: "2kb" }), (req, res) => {
  res.status(204).end();
  const ip = getIp(req);
  const now = Date.now();
  const b = traceLimiter.get(ip);
  if (b && now - b.at < 60_000) { if (++b.n > 60) return; } else traceLimiter.set(ip, { n: 1, at: now });
  if (traceLimiter.size > 5000) traceLimiter.clear();
  let body: { uid?: unknown; event?: unknown; props?: unknown };
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch { return; }
  const label = typeof body?.event === "string" ? TRACE_EVENTS[body.event] : undefined;
  const uid = typeof body?.uid === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.uid) ? body.uid : undefined;
  if (!label || !uid) return;
  const props = body.props && typeof body.props === "object" ? Object.entries(body.props as Record<string, unknown>).slice(0, 6)
    .filter(([k, v]) => /^[a-z_]{1,20}$/.test(k) && (typeof v === "string" || typeof v === "number") && String(v).length > 0)
    .map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, " ").slice(0, 80)}`).join(" ") : "";
  logVisitor(uid, `${label}${props ? ` ${props}` : ""}`);
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
app.get("/metrics", async (req, res) => {
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
    daily: await readDailyStats(Math.min(90, Math.max(1, Number(req.query.days) || 14))),
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
