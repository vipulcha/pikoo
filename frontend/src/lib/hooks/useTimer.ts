"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { RoomState, RoomSettings, TimerState, Participant, ChatMessage, SOCKET_EVENTS } from "../types";
import { connectSocket, disconnectSocket, getSocket } from "../socket";

interface UseTimerReturn {
  room: RoomState | null;
  remaining: number;
  isConnected: boolean;
  error: string | null;
  actions: {
    start: () => void;
    pause: () => void;
    reset: () => void;
    skip: () => void;
    updateSettings: (settings: Partial<RoomSettings>) => void;
    sendMessage: (text: string) => void;
  };
}

export function useTimer(roomId: string, userName: string): UseTimerReturn {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, name: userName });
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
    };

    const handleError = ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
    socket.on(SOCKET_EVENTS.TIMER_UPDATE, handleTimerUpdate);
    socket.on(SOCKET_EVENTS.PARTICIPANTS_UPDATE, handleParticipantsUpdate);
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
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
      socket.off(SOCKET_EVENTS.ERROR, handleError);
      disconnectSocket();
    };
  }, [roomId, userName, calculateRemaining]);

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
  };

  return { room, remaining, isConnected, error, actions };
}

