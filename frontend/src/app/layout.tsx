import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://pikoo.live";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pikoo - Focus together. Instantly.",
    template: "%s | Pikoo",
  },
  description:
    "Shared Pomodoro rooms with session goals, lo-fi music, and real-time presence. Built for studying, body doubling, and remote work.",
  keywords: [
    "pomodoro",
    "timer",
    "team",
    "productivity",
    "focus",
    "remote work",
    "study together",
    "body doubling",
    "shared timer",
    "focus room",
  ],
  authors: [{ name: "Pikoo" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Pikoo",
    title: "Pikoo - Focus together. Instantly.",
    description:
      "Shared Pomodoro rooms with session goals, lo-fi music, and real-time presence. Built for studying, body doubling, and remote work.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pikoo - Focus together. Instantly.",
    description:
      "Shared Pomodoro rooms with session goals, lo-fi music, and real-time presence.",
  },
  alternates: {
    canonical: SITE_URL,
  },
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
