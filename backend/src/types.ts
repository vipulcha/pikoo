// ============================================
// Pikoo - Shared Types
// ============================================

export type Phase = "focus" | "break" | "long_break";
export type RoomMode = "collab" | "host";

export interface RoomSettings {
  focusSec: number;       // default 1500 (25m)
  breakSec: number;       // default 300 (5m)
  longBreakSec: number;   // default 900 (15m)
  longBreakEvery: number; // default 4 (after 4 focus cycles)
  mode: RoomMode;         // collab: anyone can control; host: only host
}

export interface TimerState {
  running: boolean;
  phase: Phase;
  phaseEndsAt: number | null;        // epoch_ms when running
  remainingSecWhenPaused: number;    // seconds remaining when paused
  cycleCount: number;                // completed focus cycles
}

export interface Participant {
  id: string;                        // socket id (unique per connection)
  uniqueId: string;                  // persistent user id (same across tabs)
  name: string;                      // display name
}

export interface ChatMessage {
  id: string;                        // unique message id
  senderId: string;                  // socket id of sender
  senderName: string;                // display name of sender
  text: string;                      // message content
  timestamp: number;                 // epoch ms
}

export interface TodoItem {
  id: string;                        // unique todo id
  text: string;                      // todo content
  completed: boolean;                // is it done?
  createdAt: number;                 // when created
}

export interface UserTodos {
  userId: string;                  // unique user id (uniqueId from participant)
  userName: string;                  // display name
  todos: TodoItem[];                 // their todo list
  activeTodoId: string | null;       // which todo they're working on
  isPublic: boolean;                 // share with others?
}

export interface RoomState {
  id: string;
  settings: RoomSettings;
  timer: TimerState;
  hostId: string | null;             // socket id of host (if mode is "host")
  createdAt: number;
  participants: Participant[];       // participants with names
  messages: ChatMessage[];           // chat messages (max 100)
  userTodos: Record<string, UserTodos>; // todos by uniqueId
}

// Default settings
export const DEFAULT_SETTINGS: RoomSettings = {
  focusSec: 1500,       // 25 minutes
  breakSec: 300,        // 5 minutes
  longBreakSec: 900,    // 15 minutes
  longBreakEvery: 4,
  mode: "collab",
};

// Get initial timer state for a phase
export function getInitialTimerState(settings: RoomSettings): TimerState {
  return {
    running: false,
    phase: "focus",
    phaseEndsAt: null,
    remainingSecWhenPaused: settings.focusSec,
    cycleCount: 0,
  };
}

// Get duration for a phase
export function getPhaseDuration(phase: Phase, settings: RoomSettings): number {
  switch (phase) {
    case "focus":
      return settings.focusSec;
    case "break":
      return settings.breakSec;
    case "long_break":
      return settings.longBreakSec;
  }
}

// Socket Events
export const SOCKET_EVENTS = {
  // Client -> Server
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  TIMER_START: "timer_start",
  TIMER_PAUSE: "timer_pause",
  TIMER_RESET: "timer_reset",
  TIMER_SKIP: "timer_skip",
  UPDATE_SETTINGS: "update_settings",
  SEND_MESSAGE: "send_message",
  
  // Todo events (Client -> Server)
  TODO_ADD: "todo_add",
  TODO_UPDATE: "todo_update",
  TODO_DELETE: "todo_delete",
  TODO_SET_ACTIVE: "todo_set_active",
  TODO_SET_VISIBILITY: "todo_set_visibility",

  // Server -> Client
  ROOM_STATE: "room_state",
  TIMER_UPDATE: "timer_update",
  PARTICIPANTS_UPDATE: "participants_update",
  NEW_MESSAGE: "new_message",
  TODOS_UPDATE: "todos_update",
  ERROR: "error",
} as const;

