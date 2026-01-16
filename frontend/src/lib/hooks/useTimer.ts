"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { RoomState, RoomSettings, TimerState, Participant, ChatMessage, UserTodos, SOCKET_EVENTS } from "../types";
import { connectSocket, disconnectSocket, getSocket } from "../socket";
import { notifyRoomJoin } from "../audio";

interface UseTimerReturn {
  room: RoomState | null;
  remaining: number;
  isConnected: boolean;
  error: string | null;
  nameTakenError: boolean;  // True when name is already taken in room
  newMessageReceived: number;  // Increments each time a new message is received (for tracking unread)
  actions: {
    start: () => void;
    pause: () => void;
    reset: () => void;
    skip: (source?: "auto" | "manual") => void;
    updateSettings: (settings: Partial<RoomSettings>) => void;
    sendMessage: (text: string) => void;
    // Todo actions
    addTodo: (text: string) => void;
    updateTodo: (todoId: string, updates: { text?: string; completed?: boolean }) => void;
    deleteTodo: (todoId: string) => void;
    reorderTodos: (todoIds: string[]) => void;
    setActiveTodo: (todoId: string | null) => void;
    setTodoVisibility: (isPublic: boolean) => void;
  };
}

export function useTimer(roomId: string, userName: string, uniqueId: string): UseTimerReturn {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameTakenError, setNameTakenError] = useState(false);
  const [newMessageReceived, setNewMessageReceived] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const userNameRef = useRef(userName);
  const hasJoinedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate remaining time from timer state
  const calculateRemaining = useCallback((timer: TimerState): number => {
    if (!timer.running) {
      return timer.remainingSecWhenPaused;
    }
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((timer.phaseEndsAt! - now) / 1000));
    return remaining;
  }, []);

  // Update remaining time every 100ms when running
  useEffect(() => {
    if (!room?.timer.running) {
      // Clear interval if timer stops
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval before creating a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const interval = setInterval(() => {
      if (!room?.timer) {
        clearInterval(interval);
        intervalRef.current = null;
        return;
      }

      const { running, phaseEndsAt } = room.timer;

      // Stop interval if timer is no longer running
      if (!running || !phaseEndsAt) {
        clearInterval(interval);
        intervalRef.current = null;
        return;
      }

      // Check if timer has reached 0
      const now = Date.now();
      if (phaseEndsAt <= now) {
        // Timer has reached 0, stop updating remaining
        clearInterval(interval);
        intervalRef.current = null;
        // Set remaining to 0 one final time
        setRemaining(0);
        return;
      }

      // Update remaining time
      setRemaining(calculateRemaining(room.timer));
    }, 100); // Update frequently for smooth countdown

    intervalRef.current = interval;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [room?.timer, calculateRemaining]);

  // Socket connection and event handlers
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      setNameTakenError(false);
      // Use ref to get current userName (avoids dependency on userName)
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, name: userNameRef.current, uniqueId });
      hasJoinedRef.current = true;
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleRoomState = (state: RoomState) => {
      // console.log("[ROOM_STATE] Received full room state, userTodos:", JSON.stringify(state.userTodos, null, 2));
      setRoom((prev) => {
        // Initial load
        if (!prev) {
          setRemaining(calculateRemaining(state.timer));
          return state;
        }

        // Conflict Resolution:
        // Prioritize local optimistic updates if they are newer than the server state
        if (prev.timer.lastUpdatedAt && state.timer.lastUpdatedAt < prev.timer.lastUpdatedAt) {
          console.log(`[CONFLICT] Ignoring stale ROOM_STATE update (Server T=${state.timer.lastUpdatedAt} < Local T=${prev.timer.lastUpdatedAt})`);

          // We must still merge other non-timer/settings state (like participants, messages, todos)
          // ideally we'd deep merge, but for now let's just keep our local timer/settings
          // AND preserve our local userTodos (optimistic) if possible, or merge them carefully.
          // Merging todos effectively requires more complex logic (reusing handleTodosUpdate logic or similar).
          // For now, to solve the "glitch" of timer/slider jumping, we primarily protect timer/settings.

          // Strategy: Use server state but OVERWRITE with local timer/settings.
          const protectedState = {
            ...state,
            timer: prev.timer,
            settings: prev.settings,
            // Note: userTodos might also have optimistic updates. 
            // Ideally we shouldn't overwrite them with stale server data either if we made changes.
            // But let's focus on the main glitch first.
          };

          return protectedState;
        }

        setRemaining(calculateRemaining(state.timer));
        return state;
      });
    };

    const handleTimerUpdate = ({ timer }: { timer: TimerState }) => {
      setRoom((prev) => {
        if (!prev) return prev;

        // Conflict Resolution:
        // If server update is older than our local optimistic update, ignore it.
        // But if server update is newer, accept it (Last Write Wins).
        if (prev.timer.lastUpdatedAt && timer.lastUpdatedAt < prev.timer.lastUpdatedAt) {
          console.log(`[CONFLICT] Ignoring stale server update (Server T=${timer.lastUpdatedAt} < Local T=${prev.timer.lastUpdatedAt})`);
          return prev;
        }

        const updated = { ...prev, timer };
        setRemaining(calculateRemaining(timer));
        return updated;
      });
    };

    const handleParticipantsUpdate = ({ participants }: { participants: Participant[] }) => {
      setRoom((prev) => {
        if (!prev) return prev;

        // Detect new joiners
        // Only if we already had participants (don't notify on initial load/reconnect of everyone)
        if (prev.participants.length > 0) {
          const prevIds = new Set(prev.participants.map(p => p.uniqueId));
          const newJoiners = participants.filter(p => !prevIds.has(p.uniqueId));

          newJoiners.forEach(joiner => {
            // Don't notify if *we* are the joiner (compare with our uniqueId)
            if (joiner.uniqueId !== uniqueId) {
              console.log(`[JOIN_NOTIFY] New user detected: ${joiner.name}`);
              notifyRoomJoin(joiner.name);
            }
          });
        }

        return { ...prev, participants };
      });
    };

    const handleNewMessage = ({ message }: { message: ChatMessage }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        // Initialize messages array if needed
        const messages = prev.messages || [];
        return { ...prev, messages: [...messages, message] };
      });
      // Signal that a new message was received (for unread tracking)
      setNewMessageReceived(prev => prev + 1);
    };

    const handleTodosUpdate = ({ userTodos }: { userTodos: Record<string, UserTodos> }) => {
      console.log("[TODOS_UPDATE] Received:", JSON.stringify(userTodos, null, 2));
      setRoom((prev) => {
        if (!prev) {
          console.log("[TODOS_UPDATE] prev is null, ignoring");
          return prev;
        }

        // Smart merge: preserve our optimistic (temp_) todos that server doesn't know about yet
        const myUniqueId = uniqueId;
        const myLocalTodos = prev.userTodos?.[myUniqueId];
        const myServerTodos = userTodos[myUniqueId];

        if (myLocalTodos && myServerTodos) {
          // Get our pending (temp_) todos
          const pendingTodos = myLocalTodos.todos.filter(t => t.id.startsWith('temp_'));
          const serverTodoTexts = new Set(myServerTodos.todos.map(t => t.text));

          if (pendingTodos.length > 0) {
            // Only keep pending todos that DON'T have a matching text on server
            // (if server has a todo with same text, it's the real version of our temp)
            const unconfirmedPending = pendingTodos.filter(t => !serverTodoTexts.has(t.text));

            if (unconfirmedPending.length > 0) {
              console.log("[TODOS_UPDATE] Preserving unconfirmed pending todos:", unconfirmedPending.map(t => t.id));

              // Merge: server todos + unconfirmed pending todos
              const mergedTodos = [...myServerTodos.todos, ...unconfirmedPending];

              return {
                ...prev,
                userTodos: {
                  ...userTodos,
                  [myUniqueId]: {
                    ...myServerTodos,
                    todos: mergedTodos,
                    // Keep local activeTodoId if it's a temp_ id that's still pending
                    activeTodoId: myLocalTodos.activeTodoId?.startsWith('temp_') &&
                      unconfirmedPending.some(t => t.id === myLocalTodos.activeTodoId)
                      ? myLocalTodos.activeTodoId
                      : myServerTodos.activeTodoId,
                  },
                },
              };
            }

            console.log("[TODOS_UPDATE] All pending todos confirmed by server");
          }
        }

        console.log("[TODOS_UPDATE] Using server data directly");
        return { ...prev, userTodos };
      });
    };

    const handleError = ({ message, code }: { message: string; code?: string }) => {
      if (code === "NAME_TAKEN") {
        setNameTakenError(true);
        setError(message);
      } else {
        setError(message);
        setTimeout(() => setError(null), 3000);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
    socket.on(SOCKET_EVENTS.TIMER_UPDATE, handleTimerUpdate);
    socket.on(SOCKET_EVENTS.PARTICIPANTS_UPDATE, handleParticipantsUpdate);
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
    socket.on(SOCKET_EVENTS.TODOS_UPDATE, handleTodosUpdate);
    socket.on(SOCKET_EVENTS.ERROR, handleError);

    // If already connected, join room
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
      socket.off(SOCKET_EVENTS.TIMER_UPDATE, handleTimerUpdate);
      socket.off(SOCKET_EVENTS.PARTICIPANTS_UPDATE, handleParticipantsUpdate);
      socket.off(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      socket.off(SOCKET_EVENTS.TODOS_UPDATE, handleTodosUpdate);
      socket.off(SOCKET_EVENTS.ERROR, handleError);
      disconnectSocket();
      hasJoinedRef.current = false;
    };
  }, [roomId, uniqueId, calculateRemaining]); // Note: userName removed - we use UPDATE_NAME instead

  // Send UPDATE_NAME when userName changes (after initial join)
  useEffect(() => {
    // Update the ref
    userNameRef.current = userName;

    // Only send update if we've already joined the room
    if (hasJoinedRef.current && socketRef.current && userName) {
      console.log("[UPDATE_NAME] Emitting UPDATE_NAME with name:", userName);
      socketRef.current.emit(SOCKET_EVENTS.UPDATE_NAME, { name: userName });
    }
  }, [userName]);

  // Helper to update user's todos optimistically
  const updateMyTodosOptimistically = useCallback((
    updater: (currentTodos: UserTodos) => UserTodos
  ) => {
    setRoom((prev) => {
      if (!prev) return prev;
      const currentUserTodos = prev.userTodos[uniqueId] || {
        odId: uniqueId,
        userName: userNameRef.current, // Use ref to get current userName
        todos: [],
        activeTodoId: null,
        isPublic: true,
      };
      const updatedUserTodos = updater(currentUserTodos);
      return {
        ...prev,
        userTodos: {
          ...prev.userTodos,
          [uniqueId]: updatedUserTodos,
        },
      };
    });
  }, [uniqueId]); // userName removed - we use userNameRef

  // Helper to update timer state optimistically
  const updateTimerOptimistically = useCallback((
    updater: (currentTimer: TimerState) => TimerState
  ) => {
    setRoom((prev) => {
      if (!prev) return prev;
      const updatedTimer = updater(prev.timer);
      setRemaining(calculateRemaining(updatedTimer));
      return { ...prev, timer: updatedTimer };
    });
  }, [calculateRemaining]);

  // Timer control actions
  const actions = {
    start: () => {
      const timestamp = Date.now();

      // Optimistic update
      updateTimerOptimistically((current) => {
        if (current.running) return current;
        return {
          ...current,
          running: true,
          phaseEndsAt: timestamp + current.remainingSecWhenPaused * 1000,
          lastUpdatedAt: timestamp
        };
      });

      socketRef.current?.emit(SOCKET_EVENTS.TIMER_START, { timestamp });
    },

    pause: () => {
      const timestamp = Date.now();

      // Optimistic update
      updateTimerOptimistically((current) => {
        if (!current.running || !current.phaseEndsAt) return current;
        const remaining = Math.max(0, Math.ceil((current.phaseEndsAt - timestamp) / 1000));
        return {
          ...current,
          running: false,
          phaseEndsAt: null,
          remainingSecWhenPaused: remaining,
          lastUpdatedAt: timestamp
        };
      });

      socketRef.current?.emit(SOCKET_EVENTS.TIMER_PAUSE, { timestamp });
    },

    reset: () => {
      const timestamp = Date.now();

      // Optimistic update (requires room settings access, but we don't have settings inside helper easily unless we change store structure or pass it)
      // We can use setRoom callback to access full state
      setRoom((prev) => {
        if (!prev) return prev;
        // We need getPhaseDuration but it's not imported. 
        // Let's assume standard durations from RoomSettings for now or wait for server correction?
        // Better: Import getPhaseDuration helper if possible, or replicate logic simply.
        // Actually, we can just use the settings from room state.

        const getPhaseDurationSimple = (phase: string, s: RoomSettings) => {
          switch (phase) {
            case "focus": return s.focusSec;
            case "break": return s.breakSec;
            case "long_break": return s.longBreakSec;
            default: return s.focusSec;
          }
        };

        const duration = getPhaseDurationSimple(prev.timer.phase, prev.settings);
        const updatedTimer = {
          ...prev.timer,
          running: false,
          phaseEndsAt: null,
          remainingSecWhenPaused: duration,
          lastUpdatedAt: timestamp
        };

        setRemaining(duration); // Update remaining locally
        return { ...prev, timer: updatedTimer };
      });

      socketRef.current?.emit(SOCKET_EVENTS.TIMER_RESET, { timestamp });
    },

    skip: (source: "auto" | "manual" = "manual") => {
      const timestamp = Date.now();

      if (source === "manual") {
        // Optimistic update for manual skip
        setRoom((prev) => {
          if (!prev) return prev;

          // Determine next phase locally
          let nextPhase: import("../types").Phase;
          let newCycleCount = prev.timer.cycleCount;

          if (prev.timer.phase === "focus") {
            newCycleCount++;
            if (newCycleCount % prev.settings.longBreakEvery === 0) {
              nextPhase = "long_break";
            } else {
              nextPhase = "break";
            }
          } else {
            nextPhase = "focus";
          }

          const getPhaseDurationSimple = (phase: string, s: RoomSettings) => {
            switch (phase) {
              case "focus": return s.focusSec;
              case "break": return s.breakSec;
              case "long_break": return s.longBreakSec;
              default: return s.focusSec;
            }
          };

          const duration = getPhaseDurationSimple(nextPhase, prev.settings);
          const updatedTimer = {
            ...prev.timer,
            phase: nextPhase,
            cycleCount: newCycleCount,
            running: false,
            phaseEndsAt: null,
            remainingSecWhenPaused: duration,
            lastUpdatedAt: timestamp
          };

          setRemaining(duration);
          return { ...prev, timer: updatedTimer };
        });
      }

      socketRef.current?.emit(SOCKET_EVENTS.TIMER_SKIP, { source, timestamp });
    },

    updateSettings: (settings: Partial<RoomSettings>) => {
      const timestamp = Date.now();

      // Optimistic update for settings
      setRoom((prev) => {
        if (!prev) return prev;
        const newSettings = { ...prev.settings, ...settings };

        // If timer is paused, update duration if relevant setting changed
        let updatedTimer = { ...prev.timer };

        // NOTE: We update lastUpdatedAt on the timer even for settings changes
        // This ensures the Conflict Resolution in handleRoomState respects this change
        updatedTimer.lastUpdatedAt = timestamp;

        if (!updatedTimer.running) {
          const getPhaseDurationSimple = (phase: string, s: RoomSettings) => {
            switch (phase) {
              case "focus": return s.focusSec;
              case "break": return s.breakSec;
              case "long_break": return s.longBreakSec;
              default: return s.focusSec;
            }
          };
          updatedTimer.remainingSecWhenPaused = getPhaseDurationSimple(updatedTimer.phase, newSettings);
        }

        setRemaining(calculateRemaining(updatedTimer));
        return { ...prev, settings: newSettings, timer: updatedTimer };
      });

      socketRef.current?.emit(SOCKET_EVENTS.UPDATE_SETTINGS, { ...settings, timestamp });
    },
    sendMessage: (text: string) =>
      socketRef.current?.emit(SOCKET_EVENTS.SEND_MESSAGE, { text }),

    // Todo actions with OPTIMISTIC UPDATES
    addTodo: (text: string) => {
      console.log("[TODO_ADD] Adding todo:", text);
      // Optimistic: add todo locally immediately
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log("[TODO_ADD] Optimistic update with tempId:", tempId);
      updateMyTodosOptimistically((current) => {
        console.log("[TODO_ADD] Current todos before update:", current.todos.length);
        return {
          ...current,
          todos: [...current.todos, {
            id: tempId,
            text,
            completed: false,
            createdAt: Date.now(),
          }],
        };
      });
      // Then emit to server (server will broadcast real state)
      console.log("[TODO_ADD] Emitting TODO_ADD to server");
      socketRef.current?.emit(SOCKET_EVENTS.TODO_ADD, { text });
    },

    updateTodo: (todoId: string, updates: { text?: string; completed?: boolean }) => {
      // Optimistic: update todo locally immediately
      updateMyTodosOptimistically((current) => {
        const updatedTodos = current.todos.map((t) =>
          t.id === todoId ? { ...t, ...updates } : t
        );

        // If the active todo is being marked as completed, clear the active todo
        let updatedActiveTodoId = current.activeTodoId;
        if (updates.completed && current.activeTodoId === todoId) {
          updatedActiveTodoId = null;
        }

        return {
          ...current,
          todos: updatedTodos,
          activeTodoId: updatedActiveTodoId,
        };
      });
      // Then emit to server
      socketRef.current?.emit(SOCKET_EVENTS.TODO_UPDATE, { todoId, ...updates });
    },

    deleteTodo: (todoId: string) => {
      // Optimistic: remove todo locally immediately
      updateMyTodosOptimistically((current) => ({
        ...current,
        todos: current.todos.filter((t) => t.id !== todoId),
        // Clear active if deleting the active todo
        activeTodoId: current.activeTodoId === todoId ? null : current.activeTodoId,
      }));
      // Then emit to server
      socketRef.current?.emit(SOCKET_EVENTS.TODO_DELETE, { todoId });
    },

    setActiveTodo: (todoId: string | null) => {
      // Optimistic: set active todo locally immediately
      updateMyTodosOptimistically((current) => ({
        ...current,
        activeTodoId: todoId,
      }));
      // Then emit to server
      socketRef.current?.emit(SOCKET_EVENTS.TODO_SET_ACTIVE, { todoId });
    },

    reorderTodos: (todoIds: string[]) => {
      // Optimistic: reorder todos locally immediately
      updateMyTodosOptimistically((current) => {
        const todosMap = new Map(current.todos.map(t => [t.id, t]));
        const reordered = todoIds
          .map(id => todosMap.get(id))
          .filter((t): t is typeof current.todos[0] => t !== undefined);
        // Append any remaining todos not in the new order
        for (const todo of current.todos) {
          if (!todoIds.includes(todo.id)) {
            reordered.push(todo);
          }
        }
        return { ...current, todos: reordered };
      });
      // Then emit to server
      socketRef.current?.emit(SOCKET_EVENTS.TODO_REORDER, { todoIds });
    },

    setTodoVisibility: (isPublic: boolean) => {
      // Optimistic: update visibility locally immediately
      updateMyTodosOptimistically((current) => ({
        ...current,
        isPublic,
      }));
      // Then emit to server
      socketRef.current?.emit(SOCKET_EVENTS.TODO_SET_VISIBILITY, { isPublic });
    },
  };

  return { room, remaining, isConnected, error, nameTakenError, newMessageReceived, actions };
}
