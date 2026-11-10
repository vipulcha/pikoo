import { renderOgImage, OG_SIZE } from "@/lib/og";
import { getRoomPreview, describePreview } from "@/lib/api";

export const alt = "Join a focus room on Pikoo";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 30;

export default async function Image({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { title, subtitle } = describePreview(await getRoomPreview(roomId));
  // The card footer already says "Free · No sign-up"
  return renderOgImage(title, subtitle.replace(/ · free, no sign-up$/, ""));
}
