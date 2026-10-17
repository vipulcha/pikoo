"use client";

import { Socket } from "socket.io-client";

// Timer end times come from the server's clock. If this device's clock is off,
// counting down against Date.now() would show a different time than everyone else,
// so we measure the difference once per connection and use server time everywhere.
let offsetMs = 0;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

const SAMPLES = 5;

export async function syncClock(socket: Socket): Promise<void> {
  let best: { rtt: number; offset: number } | null = null;

  for (let i = 0; i < SAMPLES; i++) {
    try {
      const sentAt = Date.now();
      const serverTime: number = await socket.timeout(3000).emitWithAck("time_sync");
      const receivedAt = Date.now();
      const rtt = receivedAt - sentAt;
      // Assume the reply took half the round trip; the fastest sample is the most accurate
      const offset = serverTime + rtt / 2 - receivedAt;
      if (!best || rtt < best.rtt) best = { rtt, offset };
    } catch {
      // Timed out or disconnected; use whatever samples we have
      break;
    }
  }

  if (best) offsetMs = best.offset;
}
