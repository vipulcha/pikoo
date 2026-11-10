import type { Metadata } from "next";
import { getRoomPreview, describePreview } from "@/lib/api";

type Props = { params: Promise<{ roomId: string }>; children: React.ReactNode };

// Room links get pasted into WhatsApp, Discord and Slack, so the preview should
// say what the link is and how many people are in there (never names or chat).
export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }): Promise<Metadata> {
  const { roomId } = await params;
  const { title, subtitle } = describePreview(await getRoomPreview(roomId));
  return {
    title: { absolute: `${title} · Pikoo` },
    description: subtitle,
    robots: { index: false, follow: false },
    // Private rooms have no canonical page of their own
    alternates: { canonical: null },
    openGraph: { type: "website", title: `${title} · Pikoo`, description: subtitle, siteName: "Pikoo" },
    twitter: { card: "summary_large_image", title: `${title} · Pikoo`, description: subtitle },
  };
}

export default function RoomLayout({ children }: Props) {
  return children;
}
