# ONE FILE — Cuckoo.team Alternative (Shared Team Timer) — Full Design + Architecture Spec (Cursor)

You can paste this entire file into Cursor as the “source of truth” spec.

---

## 0) What we’re building

A web app where anyone can:
1) Create a **room**
2) Share a **link**
3) Everyone in the room sees the **same timer** in real time:
   - Start / Pause / Reset / Skip phase
   - Focus + Break + optional Long Break
4) People can refresh/join late and still see the correct current phase (no drift)

**MVP** = no login required, rooms expire automatically, basic anti-abuse.

---

## 1) Core principle (the thing that prevents drift)

**Do NOT stream “seconds ticking.”**  
Instead the server stores **timestamps**:

- `running: boolean`
- `phase: focus | break | long_break`
- `phaseEndsAt: epoch_ms` (only meaningful when running)
- `remainingSecWhenPaused` (only meaningful when paused)

Clients render the countdown locally:
- If running: `remaining = phaseEndsAt - Date.now()`
- If paused: `remaining = remainingSecWhenPaused`

This keeps everyone in sync even with lag or tab sleep.

---

## 2) High-level architecture

### Frontend (Next.js / React)
- `/r/:roomId` page:
  - connects to WebSocket
  - shows timer UI + controls
  - shows optional participant list (anonymous)
- Rendering uses server state timestamps (no server ticks)

### Backend (Node.js)
- REST API:
  - `POST /rooms` create room
  - `GET /rooms/:roomId/state` fetch canonical state (fallback, hydration)
- WebSocket gateway:
  - join room
  - accept commands
  - broadcast state updates

### Store (Redis) — MVP source of truth
- room state + TTL
- presence list + TTL
- optional host identity

Optional later:
- Postgres for history/audit (not needed for MVP)

---

## 3) Data model

### 3.1 Settings
```ts
type RoomSettings = {
  focusSec: number;        // default 1500 (25m)
  breakSec: number;        // default 300 (5m)
  longBreakSec?: number;   // default 900 (15m)
  longBreakEvery?: number; // default 4 (after 4 focus cycles)
  mode: "collab" | "host"; // collab: anyone can control; host: only host can control
};
