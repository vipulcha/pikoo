"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { RoomState, RoomSettings, TimerState, Participant, ChatMessage, UserTodos, SOCKET_EVENTS } from "../types";
import { connectSocket, disconnectSocket, getSocket } from "../socket";

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
    skip: () => void;
    updateSettings: (settings: Partial<RoomSettings>) => void;
    sendMessage: (text: string) => void;
    // Todo actions
    addTodo: (text: string) => void;
    updateTodo: (todoId: string, updates: { text?: string; completed?: boolean }) => void;
    deleteTodo: (todoId: string) => void;
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

  // Calculate remaining time from timer state
  const calculateRemaining = useCallback((timer: TimerState): number => {
    if (!timer.running) {
      return timer.remainingSecWhenPaused;
    }
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((timer.phaseEndsAt! - now) / 1000));
    return remaining;
  }, []);

  // Update remaining time every second when running
  useEffect(() => {
    if (!room?.timer.running) return;

    const interval = setInterval(() => {
      setRemaining(calculateRemaining(room.timer));
    }, 100); // Update frequently for smooth countdown

    return () => clearInterval(interval);
  }, [room?.timer, calculateRemaining]);

  // Socket connection and event handlers
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      setNameTakenError(false);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, name: userName, uniqueId });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleRoomState = (state: RoomState) => {
      setRoom(state);
      setRemaining(calculateRemaining(state.timer));
    };

    const handleTimerUpdate = ({ timer }: { timer: TimerState }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, timer };
        setRemaining(calculateRemaining(timer));
        return updated;
      });
    };

    const handleParticipantsUpdate = ({ participants }: { participants: Participant[] }) => {
      setRoom((prev) => {
        if (!prev) return prev;
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
      setRoom((prev) => {
        if (!prev) return prev;
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
    };
  }, [roomId, userName, uniqueId, calculateRemaining]);

  // Timer control actions
  const actions = {
    start: () => socketRef.current?.emit(SOCKET_EVENTS.TIMER_START),
    pause: () => socketRef.current?.emit(SOCKET_EVENTS.TIMER_PAUSE),
    reset: () => socketRef.current?.emit(SOCKET_EVENTS.TIMER_RESET),
    skip: () => socketRef.current?.emit(SOCKET_EVENTS.TIMER_SKIP),
    updateSettings: (settings: Partial<RoomSettings>) => 
      socketRef.current?.emit(SOCKET_EVENTS.UPDATE_SETTINGS, settings),
    sendMessage: (text: string) =>
      socketRef.current?.emit(SOCKET_EVENTS.SEND_MESSAGE, { text }),
    // Todo actions
    addTodo: (text: string) =>
      socketRef.current?.emit(SOCKET_EVENTS.TODO_ADD, { text }),
    updateTodo: (todoId: string, updates: { text?: string; completed?: boolean }) =>
      socketRef.current?.emit(SOCKET_EVENTS.TODO_UPDATE, { todoId, ...updates }),
    deleteTodo: (todoId: string) =>
      socketRef.current?.emit(SOCKET_EVENTS.TODO_DELETE, { todoId }),
    setActiveTodo: (todoId: string | null) =>
      socketRef.current?.emit(SOCKET_EVENTS.TODO_SET_ACTIVE, { todoId }),
    setTodoVisibility: (isPublic: boolean) =>
      socketRef.current?.emit(SOCKET_EVENTS.TODO_SET_VISIBILITY, { isPublic }),
  };

  return { room, remaining, isConnected, error, nameTakenError, newMessageReceived, actions };
}

