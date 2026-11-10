// ============================================
// Pikoo - Frontend Types (mirrors backend)
// ============================================

export type Phase = "focus" | "break" | "long_break";
export type RoomMode = "collab" | "host";

export interface RoomSettings {
  focusSec: number;
  breakSec: number;
  longBreakSec: number;
  longBreakEvery: number;
  mode: RoomMode;
  autoStart?: boolean; // Missing on older rooms
}

export interface TimerState {
  running: boolean;
  phase: Phase;
  phaseEndsAt: number | null;
  remainingSecWhenPaused: number;
  cycleCount: number;
  lastUpdatedAt: number;
  addedSec?: number;                 // time added to the current phase with +5/+10/custom
}

export interface Participant {
  id: string;       // socket id (unique per connection)
  uniqueId: string; // persistent user id (same across tabs)
  name: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderUniqueId?: string; // Missing on older messages
  senderName: string;
  text: string;
  timestamp: number;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface UserTodos {
  userId: string;
  userName: string;
  todos: TodoItem[];
  activeTodoId: string | null;
  isPublic: boolean;
}

export type ActivityType = "timer_start" | "timer_pause" | "timer_reset" | "timer_skip" | "timer_add_time" | "join" | "leave";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  timestamp: number;
  details?: string;
}

export interface RoomState {
  id: string;
  settings: RoomSettings;
  timer: TimerState;
  hostId: string | null; // uniqueId of the room creator
  createdAt: number;
  participants: Participant[];
  messages: ChatMessage[];
  userTodos: Record<string, UserTodos>;
  history: ActivityLog[];
}

export const DEFAULT_SETTINGS: RoomSettings = {
  focusSec: 1500,
  breakSec: 300,
  longBreakSec: 900,
  longBreakEvery: 4,
  mode: "collab",
  autoStart: false,
};

export const SOCKET_EVENTS = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  UPDATE_NAME: "update_name",
  TIMER_START: "timer_start",
  TIMER_PAUSE: "timer_pause",
  TIMER_RESET: "timer_reset",
  TIMER_SKIP: "timer_skip",
  TIMER_ADD_TIME: "timer_add_time",
  SPECTATE_ROOM: "spectate_room",   // view-only connection (stream overlay / Notion embed)
  UPDATE_SETTINGS: "update_settings",
  SEND_MESSAGE: "send_message",

  // Todo events
  TODO_ADD: "todo_add",
  TODO_UPDATE: "todo_update",
  TODO_DELETE: "todo_delete",
  TODO_REORDER: "todo_reorder",
  TODO_SET_ACTIVE: "todo_set_active",
  TODO_SET_VISIBILITY: "todo_set_visibility",

  ROOM_STATE: "room_state",
  TIMER_UPDATE: "timer_update",
  PARTICIPANTS_UPDATE: "participants_update",
  NEW_MESSAGE: "new_message",
  TODOS_UPDATE: "todos_update",
  ERROR: "error",
} as const;

export const PHASE_LABELS: Record<Phase, string> = {
  focus: "Focus",
  break: "Break",
  long_break: "Long Break",
};

export const PHASE_COLORS: Record<Phase, { bg: string; text: string; accent: string }> = {
  focus: { bg: "from-rose-950 to-slate-950", text: "text-rose-100", accent: "bg-rose-500" },
  break: { bg: "from-emerald-950 to-slate-950", text: "text-emerald-100", accent: "bg-emerald-500" },
  long_break: { bg: "from-blue-950 to-slate-950", text: "text-blue-100", accent: "bg-blue-500" },
};

// Limits for "add time" (mirrored on the backend)
export const MAX_ADD_TIME_SEC = 120 * 60;   // one request adds at most 2h
export const MAX_REMAINING_SEC = 4 * 60 * 60; // a phase can never hold more than 4h
