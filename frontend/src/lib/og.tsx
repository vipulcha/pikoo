import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// 1200x630 social share card in the app's look: black, rose accent, clock mark
export function renderOgImage(title: string, subtitle: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(ellipse at 80% 0%, #3b0d18 0%, #000000 60%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#000" />
            <circle cx="16" cy="16" r="10" stroke="#F43F5E" strokeWidth="2.5" fill="none" />
            <line x1="16" y1="16" x2="16" y2="9" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="16" x2="21" y2="16" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <circle cx="16" cy="16" r="1.5" fill="#F43F5E" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Pikoo</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: title.length > 40 ? 64 : 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.65)", maxWidth: 980, lineHeight: 1.3 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "rgba(255,255,255,0.5)" }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#4ade80" }} />
          Free · No sign-up · Shared Pomodoro timer
        </div>
      </div>
    ),
    OG_SIZE
  );
}
