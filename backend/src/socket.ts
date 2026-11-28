import { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  RoomSettings,
  RoomState,
  TimerState,
} from "./types.js";
import {
  getRoom,
  createRoom,
  saveRoom,
  startTimer,
  pauseTimer,
  resetTimer,
  skipPhase,
  addTime,
  MAX_ADD_TIME_SEC,
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
  setSchedule,
} from "./store.js";
import { ChatMessage, UserTodos, getInitialTimerState } from "./types.js";
import { track, logJoin, logVisitor, formatStay, markCrawler } from "./stats.js";
import { setupLibraryHandlers } from "./library.js";
import { log } from "./logger.js";
import { withRoomLock } from "./room-lock.js";
import { roomForUser, todosForUser } from "./views.js";
import { socketEventLimiter, chatMessageLimiter } from "./rate-limit.js";
import { DEV_ROOM_ID, DEV_NAME, DEV_AWAY_MS, hashSecret, isDevHostSecret, isReservedDevName, ensureDevRoom } from "./devRoom.js";
import {
  sanitizeName,
  sanitizeMessage,
  sanitizeTodoText,
  sanitizeRoomId,
  sanitizeUniqueId,
  sanitizeSchedule,
  isValidTodoId,
  isValidBoolean,
  sanitizeSettings,
  sanitizeUserSecret,
} from "./sanitize.js";

interface JoinRoomPayload {
  roomId: string;
  name: string;
  uniqueId: string;
  secret?: string;
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

// In host mode only the creator controls the timer, but only while they're in the room
// (otherwise the room would be stuck if they leave). Rooms without a recorded host stay open.
function canControl(room: RoomState, uniqueId: string): boolean {
  // The work-with-dev room is the developer's session: only they ever control it
  if (room.id === DEV_ROOM_ID) return !!room.hostId && room.hostId === uniqueId;
  if (room.settings.mode !== "host" || !room.hostId) return true;
  if (room.hostId === uniqueId) return true;
  return !room.participants.some(p => p.uniqueId === room.hostId);
}

// ============================================
// Per-viewer broadcasts (private todos and secrets stay on the server)
// ============================================

async function emitRoomState(io: Server, roomId: string, room: RoomState | null | undefined): Promise<void> {
  if (!room) return;
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    s.emit(SOCKET_EVENTS.ROOM_STATE, roomForUser(room, s.data.uniqueId));
  }
}

async function emitTodos(io: Server, roomId: string, userTodos: RoomState["userTodos"]): Promise<void> {
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    s.emit(SOCKET_EVENTS.TODOS_UPDATE, { userTodos: todosForUser(userTodos, s.data.uniqueId) });
  }
}

// ============================================
// Leave grace period
// ============================================
// A dropped connection (phone screen off, Wi-Fi blip, laptop lid) usually comes
// back within a minute. The person stays listed that long, so the room doesn't
// see them leave and rejoin; the leave is announced only if they don't return.

const LEAVE_GRACE_MS = 60_000;

interface PendingLeave {
  roomId: string;
  uniqueId: string;
  name: string;
  joinedAt: number;
  leftAt: number;
  timer: NodeJS.Timeout;
}

// Keyed by the dropped connection's socket id (its entry stays in room.participants meanwhile)
const pendingLeaves = new Map<string, PendingLeave>();

/** The same person coming back to the same room: stop their pending leave and return it */
function takePendingLeave(roomId: string, uniqueId: string): (PendingLeave & { socketId: string }) | undefined {
  for (const [socketId, p] of pendingLeaves) {
    if (p.roomId === roomId && p.uniqueId === uniqueId) {
      clearTimeout(p.timer);
      pendingLeaves.delete(socketId);
      return { ...p, socketId };
    }
  }
  return undefined;
}

/**
 * What the room's timer was doing when someone left, for the end of their leave line:
 * " · mid-focus, 13m left", " · on a break" or " · timer paused". The dashboard reads
 * the stay from the part before " · ".
 */
function leaveMoment(timer: TimerState | undefined, leftAt: number): string {
  if (!timer) return "";
  if (!timer.running) return " · timer paused";
  if (timer.phase !== "focus") return " · on a break";
  const leftMin = timer.phaseEndsAt ? Math.max(0, Math.round((timer.phaseEndsAt - leftAt) / 60_000)) : 0;
  return ` · mid-focus, ${leftMin}m left`;
}

// Must be called while holding the room lock
// `moment` is leaveMoment() taken when the connection dropped, not after the grace period
async function finishLeave(io: Server, roomId: string, socketId: string, uniqueId: string, name: string, joinedAt: number, leftAt: number, moment = ""): Promise<void> {
  if (uniqueId && joinedAt) {
    logVisitor(uniqueId, `🚪 left room ${roomId} after ${formatStay(leftAt - joinedAt)}${moment}`, name);
  }
  try {
    const roomBefore = await getRoom(roomId);
    const countBefore = roomBefore?.participants.length || 0;

    const participants = await removeParticipant(roomId, socketId);
    io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants });

    if (participants.length < countBefore) {
      await addActivity(roomId, "leave", uniqueId, name);
      const updatedRoom = await getRoom(roomId);
      if (updatedRoom) {
        await emitRoomState(io, roomId, updatedRoom);
      }
    }

    // The developer's last connection is gone: end the session unless they return soon
    if (roomId === DEV_ROOM_ID && roomBefore?.devLive && uniqueId === roomBefore.hostId &&
        !participants.some(p => p.uniqueId === uniqueId)) {
      scheduleDevAwayCheck(io, DEV_AWAY_MS);
    }
  } catch (err) {
    log.socket.error("Disconnect cleanup error", { error: String(err) });
  }
}

// ============================================
// Work-with-dev room: live sessions
// ============================================

let devAwayTimer: NodeJS.Timeout | null = null;
// People (other than the developer) who joined during the current session, for the log line at the end
const devSessionVisitors = new Set<string>();

function cancelDevAwayCheck(): void {
  if (devAwayTimer) clearTimeout(devAwayTimer);
  devAwayTimer = null;
}

function scheduleDevAwayCheck(io: Server, delayMs: number): void {
  cancelDevAwayCheck();
  devAwayTimer = setTimeout(() => {
    devAwayTimer = null;
    withRoomLock(DEV_ROOM_ID, async () => {
      const room = await getRoom(DEV_ROOM_ID);
      if (!room?.devLive) return;
      if (room.participants.some(p => p.uniqueId === room.hostId)) return;
      await endDevLive(io, room, "developer left");
    }).catch((err) => log.socket.error("Dev away check error", { error: String(err) }));
  }, delayMs);
  devAwayTimer.unref();
}

// Must be called while holding the dev room lock
async function endDevLive(io: Server, room: RoomState, why: string): Promise<void> {
  const since = room.devLive?.since ?? Date.now();
  room.devLive = null;
  // The next session starts clean: no chat, no leftover visitor task lists, timer back to the start
  room.messages = [];
  room.userTodos = room.hostId && room.userTodos[room.hostId] ? { [room.hostId]: room.userTodos[room.hostId] } : {};
  room.timer = getInitialTimerState(room.settings);
  await saveRoom(room);
  scheduleAutoAdvance(io, DEV_ROOM_ID, room.timer);
  cancelDevAwayCheck();
  await emitRoomState(io, DEV_ROOM_ID, room);
  log.server.info("Dev room session ended", { why, after: formatStay(Date.now() - since), visitors: devSessionVisitors.size });
  devSessionVisitors.clear();
}

/** On startup: a session that was live before a restart ends unless the developer reconnects */
export async function resumeDevRoom(io: Server): Promise<void> {
  const room = await ensureDevRoom();
  if (room?.devLive) scheduleDevAwayCheck(io, LEAVE_GRACE_MS + DEV_AWAY_MS);
}

// ============================================
// Server-side phase transitions
// ============================================
// The server ends each phase when its time is up, so the room moves on even if
// nobody who saw the timer start is still connected.

const phaseTimers = new Map<string, NodeJS.Timeout>();

function scheduleAutoAdvance(io: Server, roomId: string, timer: TimerState | undefined): void {
  const existing = phaseTimers.get(roomId);
  if (existing) clearTimeout(existing);
  phaseTimers.delete(roomId);

  if (!timer?.running || !timer.phaseEndsAt) return;

  const handle = setTimeout(() => {
    phaseTimers.delete(roomId);
    withRoomLock(roomId, () => advanceIfDue(io, roomId)).catch((err) => {
      log.socket.error("Auto-advance error", { error: String(err), roomId });
    });
  }, Math.max(0, timer.phaseEndsAt - Date.now()));
  handle.unref();
  phaseTimers.set(roomId, handle);
}

// Must be called while holding the room lock
async function advanceIfDue(io: Server, roomId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) return;

  const { running, phaseEndsAt, phase } = room.timer;
  if (!running || !phaseEndsAt || phaseEndsAt > Date.now()) {
    // Paused or changed since this was scheduled
    scheduleAutoAdvance(io, roomId, room.timer);
    return;
  }

  const timer = await skipPhase(roomId, "system", "Timer", {
    expectedPhase: phase,
    expectedPhaseEndsAt: phaseEndsAt,
    expectedRunning: true,
  });
  if (!timer) return;

  io.to(roomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
  const updatedRoom = await getRoom(roomId);
  if (updatedRoom) {
    await emitRoomState(io, roomId, updatedRoom);
  }
  scheduleAutoAdvance(io, roomId, timer);
  log.socket.info("Phase auto-advanced", { roomId, from: phase, to: timer.phase });

  // Usage trace, after the room is updated so it can never hold up the timer: one line
  // per person who was there when a focus session ran to the end (people whose
  // connection already dropped and are only in the leave grace period don't count)
  if (phase === "focus") {
    try {
      const leaving = new Set([...pendingLeaves.values()].filter((p) => p.roomId === roomId).map((p) => p.uniqueId));
      const seen = new Set<string>();
      const min = Math.round((room.settings.focusSec + (room.timer.addedSec ?? 0)) / 60);
      for (const p of room.participants) {
        if (!p.uniqueId || seen.has(p.uniqueId) || leaving.has(p.uniqueId)) continue;
        seen.add(p.uniqueId);
        logVisitor(p.uniqueId, `🍅 finished a ${min}-min focus in room ${roomId}`, p.name);
      }
    } catch (err) {
      log.socket.warn("Focus-finished trace failed", { error: String(err), roomId });
    }
  }
}

async function cleanupStaleParticipants(io: Server, roomId: string): Promise<void> {
  try {
    const room = await getRoom(roomId);
    if (!room) return;

    const socketsInRoom = await io.in(roomId).fetchSockets();
    const connectedSocketIds = new Set(socketsInRoom.map(s => s.id));

    const verifiedStaleParticipants = room.participants.filter(p => {
      if (connectedSocketIds.has(p.id)) return false;
      if (pendingLeaves.has(p.id)) return false; // dropped, but within its grace period
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
    let joinedAt = 0;

    // What each room action looks like in the visitor trace (logged on every attempt)
    const ACTION_LABEL: Record<string, (p: unknown) => string | null> = {
      [SOCKET_EVENTS.TIMER_START]: () => "▶️ started the timer",
      [SOCKET_EVENTS.TIMER_PAUSE]: () => "⏸️ paused the timer",
      [SOCKET_EVENTS.TIMER_RESET]: () => "🔄 reset the timer",
      [SOCKET_EVENTS.TIMER_SKIP]: (p) => ((p as { source?: string } | undefined)?.source === "auto" ? null : "⏭️ skipped the phase"),
      [SOCKET_EVENTS.TIMER_ADD_TIME]: (p) => `➕ added ${Math.round(Number((p as { seconds?: unknown } | undefined)?.seconds) / 60) || "?"} min`,
      [SOCKET_EVENTS.UPDATE_SETTINGS]: (p) => `⚙️ changed settings ${JSON.stringify(p ?? {}).slice(0, 120)}`,
      [SOCKET_EVENTS.UPDATE_SCHEDULE]: (p) => (p ? "📅 set a schedule" : "📅 removed the schedule"),
      [SOCKET_EVENTS.SEND_MESSAGE]: () => "💬 sent a chat message",
      [SOCKET_EVENTS.TODO_ADD]: () => "📝 added a task",
      [SOCKET_EVENTS.TODO_UPDATE]: (p) => ((p as { completed?: unknown } | undefined)?.completed === true ? "✅ completed a task" : "📝 edited a task"),
      [SOCKET_EVENTS.TODO_DELETE]: () => "🗑️ deleted a task",
      [SOCKET_EVENTS.TODO_SET_ACTIVE]: () => "🎯 picked a task to work on",
      [SOCKET_EVENTS.TODO_SET_VISIBILITY]: () => "👁️ changed task visibility",
      [SOCKET_EVENTS.UPDATE_NAME]: (p) => `✏️ set their name to "${String((p as { name?: unknown } | undefined)?.name ?? "").slice(0, 40)}"`,
    };

    // Silent library (public, schedule-driven rooms): see library.ts
    setupLibraryHandlers(io, socket, rateLimited);

    // Clock sync: clients measure their offset from server time (see frontend lib/clock.ts)
    socket.on("time_sync", (ack: unknown) => {
      if (typeof ack === "function") ack(Date.now());
    });

    // Register a handler that runs under its room's lock (see room-lock.ts)
    const on = <P>(event: string, handler: (payload: P) => Promise<void>) => {
      socket.on(event, (payload: P) => {
        // Removed from the work-with-dev room: ignore anything else they send
        if (socket.data.removed && event !== "disconnect") return;
        const label = currentUniqueId ? ACTION_LABEL[event]?.(payload) : null;
        if (label) logVisitor(currentUniqueId, `${label} in room ${currentRoomId}`, currentUserName);
        const roomId = event === SOCKET_EVENTS.JOIN_ROOM
          ? sanitizeRoomId((payload as { roomId?: unknown } | undefined)?.roomId)
          : currentRoomId;
        return roomId ? withRoomLock(roomId, () => handler(payload)) : handler(payload);
      });
    };

    // ========================================
    // Join Room
    // ========================================
    on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      if (rateLimited(socket)) return;

      const roomId = sanitizeRoomId(payload?.roomId);
      let name = sanitizeName(payload?.name) || "Anonymous";
      const uniqueId = sanitizeUniqueId(payload?.uniqueId);

      if (!roomId || !uniqueId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid room ID or user ID" });
        return;
      }

      try {
        let room = roomId === DEV_ROOM_ID ? await ensureDevRoom() : await getRoom(roomId);

        if (!room) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found", code: "ROOM_NOT_FOUND" });
          return;
        }

        // A uniqueId is public (other clients see it), so the first browser to join
        // with a secret claims it; later joins must present the same secret.
        const secret = sanitizeUserSecret(payload?.secret);
        const knownHash = room.userSecrets?.[uniqueId];
        if (knownHash && (!secret || hashSecret(secret) !== knownHash)) {
          log.security.warn("Join rejected: uniqueId secret mismatch", { roomId });
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Could not verify your identity for this room" });
          return;
        }

        // Work-with-dev room: the developer can always come in (to go live); everyone
        // else only while a session is live, unless the developer removed them
        const isDevHost = roomId === DEV_ROOM_ID && isDevHostSecret(secret);
        if (roomId === DEV_ROOM_ID) {
          if (isDevHost) {
            name = DEV_NAME;
            // A leftover entry from this browser under an older id would block the fixed name
            const stale = room.participants.filter(p => p.name === DEV_NAME && p.uniqueId !== uniqueId);
            if (room.hostId !== uniqueId || room.settings.mode !== "host" || stale.length) {
              room.hostId = uniqueId;
              room.settings = { ...room.settings, mode: "host" };
              room.participants = room.participants.filter(p => !stale.includes(p));
              await saveRoom(room);
            }
            cancelDevAwayCheck();
          } else if (room.devBlocked?.includes(uniqueId)) {
            socket.emit(SOCKET_EVENTS.ERROR, { message: "You were removed from this session", code: "REMOVED" });
            return;
          } else if (!room.devLive) {
            socket.emit(SOCKET_EVENTS.ERROR, { message: "The developer isn't live right now", code: "DEV_OFFLINE" });
            return;
          } else if (isReservedDevName(name)) {
            socket.emit(SOCKET_EVENTS.ERROR, { message: "That name is reserved here, please pick another", code: "NAME_TAKEN" });
            return;
          }
        }

        if (!knownHash && secret) {
          room.userSecrets = { ...room.userSecrets, [uniqueId]: hashSecret(secret) };
          await saveRoom(room);
        }

        // Back within the grace period after a dropped connection: take over the old place quietly
        const resumed = takePendingLeave(roomId, uniqueId);
        const result = await addParticipant(roomId, socket.id, uniqueId, name, resumed?.socketId);

        if (!result.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: result.error || "Failed to join room",
            code: "NAME_TAKEN"
          });
          return;
        }

        socket.join(roomId);
        socket.data.uniqueId = uniqueId;
        socket.data.devHost = isDevHost;
        if (roomId === DEV_ROOM_ID && !isDevHost) devSessionVisitors.add(uniqueId);
        markCrawler(uniqueId, socket.handshake.headers["user-agent"]);
        currentRoomId = roomId;
        currentUserName = name;
        currentUniqueId = uniqueId;

        await ensureUserTodos(roomId, uniqueId, currentUserName);
        await cleanupStaleParticipants(io, roomId);
        room = await getRoom(roomId);

        // Catch up on a phase that ended while nobody was here (or the server restarted)
        if (room?.timer.running) {
          if (room.timer.phaseEndsAt && room.timer.phaseEndsAt <= Date.now()) {
            await advanceIfDue(io, roomId);
            room = await getRoom(roomId);
          } else if (!phaseTimers.has(roomId)) {
            scheduleAutoAdvance(io, roomId, room.timer);
          }
        }

        if (room) socket.emit(SOCKET_EVENTS.ROOM_STATE, roomForUser(room, uniqueId));

        if (name !== "Anonymous") {
          await emitRoomState(io, roomId, room);
        } else {
          io.to(roomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants: room?.participants || [] });
        }

        if (resumed) {
          // Same visit continuing: keep its start time, no new join in the stats or the visitor log
          joinedAt = resumed.joinedAt;
          log.socket.info("Reconnected within grace period", { roomId, name, awaySec: Math.round((Date.now() - resumed.leftAt) / 1000) });
        } else {
          track("room_joins", uniqueId);
          joinedAt = Date.now();
          void logJoin(`room ${roomId}`, uniqueId, name);
          log.socket.info("User joined room", { roomId, name, socketId: socket.id.slice(-6) });
        }
      } catch (err) {
        log.socket.error("Join room error", { error: String(err), roomId });
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to join room" });
      }
    });

    // ========================================
    // Spectate (view-only: stream overlay / Notion embed)
    // ========================================
    // Joins the room's broadcast channel without becoming a participant, so the
    // overlay isn't counted as a person and can't control anything. Every control
    // handler requires currentRoomId, which a spectator never sets.
    on(SOCKET_EVENTS.SPECTATE_ROOM, async (payload: { roomId?: unknown }) => {
      if (rateLimited(socket)) return;
      if (currentRoomId) return;

      const roomId = sanitizeRoomId(payload?.roomId);
      if (!roomId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid room ID" });
        return;
      }

      try {
        const room = await getRoom(roomId);
        if (!room) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Room not found", code: "ROOM_NOT_FOUND" });
          return;
        }
        socket.join(roomId);
        socket.data.spectator = true;
        socket.emit(SOCKET_EVENTS.ROOM_STATE, roomForUser(room, undefined));
        track("embed_views");
      } catch (err) {
        log.socket.error("Spectate error", { error: String(err), roomId });
      }
    });

    // ========================================
    // Update Name
    // ========================================
    on(SOCKET_EVENTS.UPDATE_NAME, async (payload: UpdateNamePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      const name = sanitizeName(payload?.name);
      if (!name) return;

      // Work-with-dev room: the developer keeps their fixed name; nobody else can take a lookalike
      if (currentRoomId === DEV_ROOM_ID) {
        if (socket.data.devHost) return;
        if (isReservedDevName(name)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "That name is reserved here, please pick another", code: "NAME_TAKEN" });
          return;
        }
      }

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
            await emitRoomState(io, currentRoomId, updatedRoomWithHistory);
          }
        }

        currentUserName = name;

        io.to(currentRoomId).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, {
          participants: result.participants
        });

        const room = await getRoom(currentRoomId);
        if (room) {
          await emitTodos(io, currentRoomId, room.userTodos);
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
    on(SOCKET_EVENTS.TIMER_START, async () => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (!canControl(room, currentUniqueId)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await startTimer(currentRoomId, socket.id, currentUserName);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          scheduleAutoAdvance(io, currentRoomId, timer);
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            await emitRoomState(io, currentRoomId, updatedRoom);
          }
        }
      } catch (err) {
        log.socket.error("Timer start error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TIMER_PAUSE, async () => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (!canControl(room, currentUniqueId)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await pauseTimer(currentRoomId, socket.id, currentUserName);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          scheduleAutoAdvance(io, currentRoomId, timer);
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            await emitRoomState(io, currentRoomId, updatedRoom);
          }
        }
      } catch (err) {
        log.socket.error("Timer pause error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TIMER_RESET, async () => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (!canControl(room, currentUniqueId)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await resetTimer(currentRoomId, socket.id, currentUserName);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          scheduleAutoAdvance(io, currentRoomId, timer);
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            await emitRoomState(io, currentRoomId, updatedRoom);
          }
        }
      } catch (err) {
        log.socket.error("Timer reset error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TIMER_ADD_TIME, async (payload?: { seconds?: unknown }) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      const seconds = Math.floor(Number(payload?.seconds));
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_ADD_TIME_SEC) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid amount of time" });
        return;
      }

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (!canControl(room, currentUniqueId)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can control the timer" });
          return;
        }

        const timer = await addTime(currentRoomId, socket.id, currentUserName, seconds);
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          scheduleAutoAdvance(io, currentRoomId, timer);
          const updatedRoom = await getRoom(currentRoomId);
          if (updatedRoom) {
            await emitRoomState(io, currentRoomId, updatedRoom);
          }
        }
      } catch (err) {
        log.socket.error("Timer add time error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TIMER_SKIP, async (payload?: { source?: "auto" | "manual" }) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (!canControl(room, currentUniqueId)) {
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
            : undefined
        );
        if (timer) {
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer });
          scheduleAutoAdvance(io, currentRoomId, timer);
          if (source === "manual") {
            const updatedRoom = await getRoom(currentRoomId);
            if (updatedRoom) {
              await emitRoomState(io, currentRoomId, updatedRoom);
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
    on(SOCKET_EVENTS.UPDATE_SETTINGS, async (payload: Partial<RoomSettings>) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;

        if (!canControl(room, currentUniqueId)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can change settings" });
          return;
        }

        const cleanSettings = sanitizeSettings(payload);
        if (!cleanSettings) return;

        const settings = await updateSettings(currentRoomId, cleanSettings as Partial<RoomSettings>);
        if (settings) {
          const updatedRoom = await getRoom(currentRoomId);
          await emitRoomState(io, currentRoomId, updatedRoom);
          io.to(currentRoomId).emit(SOCKET_EVENTS.TIMER_UPDATE, { timer: updatedRoom?.timer });
          scheduleAutoAdvance(io, currentRoomId, updatedRoom?.timer);
        }
      } catch (err) {
        log.socket.error("Settings update error", { error: String(err) });
      }
    });

    // ========================================
    // Session schedule (shown in the room, exported to calendars)
    // ========================================
    on(SOCKET_EVENTS.UPDATE_SCHEDULE, async (payload: unknown) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId) return;

      try {
        const room = await getRoom(currentRoomId);
        if (!room) return;
        if (!canControl(room, currentUniqueId)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Only the host can change the schedule" });
          return;
        }
        const schedule = sanitizeSchedule(payload);
        if (schedule === undefined) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid schedule" });
          return;
        }
        const updated = await setSchedule(currentRoomId, schedule);
        if (updated) {
          track("schedules_set");
          await emitRoomState(io, currentRoomId, updated);
        }
      } catch (err) {
        log.socket.error("Schedule update error", { error: String(err) });
      }
    });

    // ========================================
    // Chat Messages
    // ========================================
    on(SOCKET_EVENTS.SEND_MESSAGE, async (payload: SendMessagePayload) => {
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
          senderUniqueId: currentUniqueId,
          senderName: currentUserName,
          text,
          timestamp: Date.now(),
        };

        const savedMessage = await addMessage(currentRoomId, message);
        if (savedMessage) track("messages_sent");
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
    on(SOCKET_EVENTS.TODO_ADD, async (payload: TodoAddPayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const text = sanitizeTodoText(payload?.text);
        if (!text) return;

        const userTodos = await addTodo(currentRoomId, currentUniqueId, currentUserName, text);
        if (userTodos) {
          await emitTodos(io, currentRoomId, userTodos);
        }
      } catch (err) {
        log.socket.error("Todo add error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TODO_UPDATE, async (payload: TodoUpdatePayload) => {
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
          await emitTodos(io, currentRoomId, userTodos);
        }
      } catch (err) {
        log.socket.error("Todo update error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TODO_DELETE, async (payload: TodoDeletePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        if (!isValidTodoId(payload?.todoId)) return;

        const userTodos = await deleteTodo(currentRoomId, currentUniqueId, payload.todoId);
        if (userTodos) {
          await emitTodos(io, currentRoomId, userTodos);
        }
      } catch (err) {
        log.socket.error("Todo delete error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TODO_SET_ACTIVE, async (payload: TodoSetActivePayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const todoId = payload?.todoId;
        if (todoId !== null && !isValidTodoId(todoId)) return;

        const userTodos = await setActiveTodo(currentRoomId, currentUniqueId, todoId);
        if (userTodos) {
          await emitTodos(io, currentRoomId, userTodos);
        }
      } catch (err) {
        log.socket.error("Todo set active error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TODO_SET_VISIBILITY, async (payload: TodoSetVisibilityPayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        if (!isValidBoolean(payload?.isPublic)) return;

        const userTodos = await setTodoVisibility(currentRoomId, currentUniqueId, payload.isPublic, currentUserName);
        if (userTodos) {
          await emitTodos(io, currentRoomId, userTodos);
        }
      } catch (err) {
        log.socket.error("Todo visibility error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.TODO_REORDER, async (payload: TodoReorderPayload) => {
      if (rateLimited(socket)) return;
      if (!currentRoomId || !currentUniqueId) return;

      try {
        const todoIds = payload?.todoIds;
        if (!Array.isArray(todoIds) || todoIds.length > 100) return;
        if (!todoIds.every(id => typeof id === "string" && id.length < 100)) return;

        const userTodos = await reorderTodos(currentRoomId, currentUniqueId, todoIds);
        if (userTodos) {
          await emitTodos(io, currentRoomId, userTodos);
        }
      } catch (err) {
        log.socket.error("Todo reorder error", { error: String(err) });
      }
    });

    // ========================================
    // Work-with-dev room (developer only)
    // ========================================
    const devHostIn = () => currentRoomId === DEV_ROOM_ID && socket.data.devHost === true;

    on(SOCKET_EVENTS.DEV_GO_LIVE, async () => {
      if (rateLimited(socket) || !devHostIn()) return;
      try {
        const room = await getRoom(DEV_ROOM_ID);
        if (!room || room.devLive) return;
        // A fresh session: empty chat and history
        room.devLive = { since: Date.now() };
        room.hostId = currentUniqueId;
        room.settings = { ...room.settings, mode: "host" };
        room.messages = [];
        room.history = [];
        await saveRoom(room);
        devSessionVisitors.clear();
        cancelDevAwayCheck();
        await emitRoomState(io, DEV_ROOM_ID, room);
        log.server.info("Dev room is live");
      } catch (err) {
        log.socket.error("Dev go live error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.DEV_END_LIVE, async () => {
      if (rateLimited(socket) || !devHostIn()) return;
      try {
        const room = await getRoom(DEV_ROOM_ID);
        if (room?.devLive) await endDevLive(io, room, "ended by the developer");
      } catch (err) {
        log.socket.error("Dev end live error", { error: String(err) });
      }
    });

    on(SOCKET_EVENTS.DEV_DELETE_MESSAGE, async (payload: { messageId?: unknown }) => {
      if (rateLimited(socket) || !devHostIn()) return;
      const messageId = typeof payload?.messageId === "string" ? payload.messageId.slice(0, 120) : "";
      if (!messageId) return;
      try {
        const room = await getRoom(DEV_ROOM_ID);
        if (!room) return;
        const before = room.messages.length;
        room.messages = room.messages.filter(m => m.id !== messageId);
        if (room.messages.length === before) return;
        await saveRoom(room);
        await emitRoomState(io, DEV_ROOM_ID, room);
      } catch (err) {
        log.socket.error("Dev delete message error", { error: String(err) });
      }
    });

    // Removes someone for good: their messages and tasks go too, and they can't rejoin
    on(SOCKET_EVENTS.DEV_REMOVE_PERSON, async (payload: { uniqueId?: unknown }) => {
      if (rateLimited(socket) || !devHostIn()) return;
      const target = sanitizeUniqueId(payload?.uniqueId);
      if (!target || target === currentUniqueId) return;
      try {
        const room = await getRoom(DEV_ROOM_ID);
        if (!room) return;
        room.devBlocked = [...(room.devBlocked ?? []).filter(id => id !== target), target].slice(-500);
        room.participants = room.participants.filter(p => p.uniqueId !== target);
        room.messages = room.messages.filter(m => m.senderUniqueId !== target);
        delete room.userTodos[target];
        await saveRoom(room);
        takePendingLeave(DEV_ROOM_ID, target);

        for (const s of await io.in(DEV_ROOM_ID).fetchSockets()) {
          if (s.data.uniqueId !== target) continue;
          s.data.removed = true;
          s.emit(SOCKET_EVENTS.ERROR, { message: "You were removed from this session", code: "REMOVED" });
          s.leave(DEV_ROOM_ID);
        }
        io.to(DEV_ROOM_ID).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATE, { participants: room.participants });
        await emitRoomState(io, DEV_ROOM_ID, room);
        logVisitor(target, "🚫 was removed from the work-with-dev room");
      } catch (err) {
        log.socket.error("Dev remove person error", { error: String(err) });
      }
    });

    // ========================================
    // Disconnect
    // ========================================
    on("disconnect", async (reason: string) => {
      log.socket.info("Client disconnected", {
        socketId: socket.id.slice(-6),
        reason,
        roomId: currentRoomId,
        user: currentUserName,
      });
      if (!currentRoomId) return;

      const roomId = currentRoomId;
      const uniqueId = currentUniqueId;
      const name = currentUserName;
      const leftAt = Date.now();
      // What the timer was doing right now, for the leave line (written after the grace period)
      const moment = leaveMoment((await getRoom(roomId).catch(() => null))?.timer, leftAt);

      // Left on purpose (the page closed the connection) or removed: no grace period
      if (reason === "client namespace disconnect" || reason === "server namespace disconnect" || socket.data.removed || !uniqueId) {
        await finishLeave(io, roomId, socket.id, uniqueId, name, joinedAt, leftAt, moment);
        return;
      }

      const timer = setTimeout(() => {
        if (!pendingLeaves.delete(socket.id)) return; // they came back
        withRoomLock(roomId, () => finishLeave(io, roomId, socket.id, uniqueId, name, joinedAt, leftAt, moment)).catch((err) => {
          log.socket.error("Delayed leave error", { error: String(err), roomId });
        });
      }, LEAVE_GRACE_MS);
      timer.unref();
      pendingLeaves.set(socket.id, { roomId, uniqueId, name, joinedAt, leftAt, timer });
    });
  });
}
