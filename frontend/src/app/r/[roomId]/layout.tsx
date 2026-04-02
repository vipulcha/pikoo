import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Focus Room",
  description:
    "Join this shared Pomodoro focus room on Pikoo. Stay focused together with a synchronized timer, lo-fi music, and real-time presence.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
