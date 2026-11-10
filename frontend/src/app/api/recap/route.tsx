import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

// 1080x1920 story image for sharing today's focus time (Instagram / WhatsApp status).
// Numbers come from the query string and are clamped; nothing is stored.
const clamp = (v: string | null, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const minutes = clamp(q.get("m"), 24 * 60);
  const sessions = clamp(q.get("s"), 99);
  const withOthers = clamp(q.get("w"), 99);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const big = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "140px 96px", color: "white", fontFamily: "sans-serif",
          background: "radial-gradient(ellipse at 50% 30%, #4c0f1e 0%, #000 65%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="84" height="84" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="10" stroke="#F43F5E" strokeWidth="2.5" fill="none" />
            <line x1="16" y1="16" x2="16" y2="9" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="16" x2="21" y2="16" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          </svg>
          <div style={{ fontSize: 56, fontWeight: 700 }}>Pikoo</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 48, color: "#fda4af", letterSpacing: 6, textTransform: "uppercase" }}>Focused today</div>
          <div style={{ fontSize: 220, fontWeight: 700, letterSpacing: -8, lineHeight: 1 }}>{big}</div>
          <div style={{ fontSize: 52, color: "rgba(255,255,255,0.7)" }}>
            {`${sessions} Pomodoro session${sessions === 1 ? "" : "s"}${withOthers > 0 ? ` · with ${withOthers} other${withOthers > 1 ? "s" : ""}` : ""}`}
          </div>
        </div>
        <div style={{ fontSize: 44, color: "rgba(255,255,255,0.55)" }}>{`Focus together, free · ${new URL(SITE_URL).host}`}</div>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}
