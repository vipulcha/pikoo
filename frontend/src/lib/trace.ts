"use client";

import { getUserId } from "@/components/NamePrompt";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// Visitor trace: one line per page view or notable click in the backend logs,
// tagged with a hash of this browser's random id (see backend stats.ts). Fire and
// forget; never blocks the UI.
export function trace(event: string, props: Record<string, string | number | undefined> = {}): void {
  try {
    const uid = getUserId();
    if (!uid) return;
    const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== ""));
    // Browsers driven by automation software say so; the backend counts them as bots
    const auto = typeof navigator !== "undefined" && navigator.webdriver === true ? true : undefined;
    void fetch(`${BACKEND_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ uid, event, props: clean, auto }),
      keepalive: true,
      mode: "no-cors",
    }).catch(() => {});
  } catch {
    // Tracing must never break the page
  }
}
