import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pikoo - Shared Team Timer",
  description: "A shared Pomodoro timer for remote collaboration. Focus together, anywhere.",
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
