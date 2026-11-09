import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon for iOS (SVG favicons aren't used there)
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#000" }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <rect width="32" height="32" fill="#000" />
          <circle cx="16" cy="16" r="10" stroke="#F43F5E" strokeWidth="2.5" fill="none" />
          <line x1="16" y1="16" x2="16" y2="9" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="16" y1="16" x2="21" y2="16" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <circle cx="16" cy="16" r="1.5" fill="#F43F5E" />
        </svg>
      </div>
    ),
    size
  );
}
