import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Pikoo - Focus together. Instantly.",
  description: "Shared Pomodoro rooms with session goals, lo-fi music, and real-time presence. Built for studying, body doubling, and remote work.",
  keywords: ["pomodoro", "timer", "team", "productivity", "focus", "remote work"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&family=Sora:wght@100..800&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body 
        className="antialiased font-sans"
        style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
