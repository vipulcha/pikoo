import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Focus timer",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
