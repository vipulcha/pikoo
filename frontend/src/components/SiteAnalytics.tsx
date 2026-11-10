"use client";

import { Analytics } from "@vercel/analytics/next";

// Cookieless page analytics (Vercel Web Analytics). Room and embed codes are
// replaced before sending, so private room links never reach the analytics.
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        url.pathname = url.pathname.replace(/^\/(r|embed)\/[^/]+/, "/$1/[room]");
        return { ...event, url: url.toString() };
      }}
    />
  );
}
