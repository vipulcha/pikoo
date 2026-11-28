"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trace } from "@/lib/trace";

const secs = (ms: number) => `${Math.round(ms / 1000)}s`;
// A tab switch shorter than this isn't worth a line; it still counts in the totals
const BACK_MIN_MS = 60_000;
const MAX_BACK_LINES = 5;
const MAX_ERRORS = 3;

// Logs each page view (with where the visitor came from on the first one), the
// first time the tab goes to the background ("switched away", which on phones
// is often the last thing we hear), coming back after a minute or more, and on
// leaving or switching pages how long they stayed and how much of that the page
// was actually on screen. Also reports the first few JavaScript errors per page.
export function TraceView() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/embed")) return;
    const start = Date.now();
    const q = new URLSearchParams(window.location.search);
    let ref: string | undefined;
    try { ref = document.referrer ? new URL(document.referrer).host : undefined; } catch { ref = undefined; }
    if (ref === window.location.host) ref = undefined;
    trace("page", {
      path: pathname,
      from: first.current ? ref ?? "direct" : undefined,
      utm: q.get("utm_source") ?? q.get("ref") ?? undefined,
      device: first.current ? (window.innerWidth < 640 ? "phone" : window.innerWidth < 1024 ? "tablet" : "desktop") : undefined,
    });
    first.current = false;

    let visibleMs = 0;
    let visibleSince: number | null = document.visibilityState === "visible" ? start : null;
    let hiddenAt: number | null = document.visibilityState === "hidden" ? start : null;
    let switches = 0;
    let awaySent = false;
    let backLines = 0;
    let sent = false;

    const onVisibility = () => {
      const now = Date.now();
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) visibleMs += now - visibleSince;
        visibleSince = null;
        hiddenAt = now;
        switches++;
        if (!awaySent && !sent) {
          awaySent = true;
          trace("away", { path: pathname, after: secs(now - start) });
        }
      } else {
        visibleSince = now;
        if (hiddenAt !== null && now - hiddenAt >= BACK_MIN_MS && backLines < MAX_BACK_LINES && !sent) {
          backLines++;
          trace("back", { path: pathname, away: secs(now - hiddenAt) });
        }
        hiddenAt = null;
      }
    };
    const leave = () => {
      if (sent) return;
      sent = true;
      const now = Date.now();
      if (visibleSince !== null) visibleMs += now - visibleSince;
      trace("leave_page", { path: pathname, after: secs(now - start), seen: secs(visibleMs), switches });
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      leave();
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  // JavaScript errors: the first few distinct ones per page load, our own code only
  useEffect(() => {
    const seen = new Set<string>();
    const report = (msg: string) => {
      msg = msg.trim();
      if (!msg || seen.has(msg) || seen.size >= MAX_ERRORS) return;
      // Browser noise, and errors from other sites' scripts that hide their message
      if (/ResizeObserver loop|^Script error\.?$/i.test(msg)) return;
      seen.add(msg);
      trace("error", { where: "js", path: window.location.pathname, msg: msg.slice(0, 80) });
    };
    const onError = (e: ErrorEvent) => {
      if (e.filename && !e.filename.startsWith(window.location.origin)) return; // extensions, other sites
      report(e.message ?? "");
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      report(e.reason instanceof Error ? e.reason.message : String(e.reason ?? ""));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
