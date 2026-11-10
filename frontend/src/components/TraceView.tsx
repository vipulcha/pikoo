"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trace } from "@/lib/trace";

// Logs each page view (with where the visitor came from on the first one) and
// how long they stayed when they leave or switch pages.
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
    let sent = false;
    const leave = () => {
      if (sent) return;
      sent = true;
      trace("leave_page", { path: pathname, after: `${Math.round((Date.now() - start) / 1000)}s` });
    };
    const onHide = () => { if (document.visibilityState === "hidden") leave(); };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      leave();
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [pathname]);

  return null;
}
