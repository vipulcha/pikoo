import { renderOgImage, OG_SIZE } from "@/lib/og";

export const alt = "Pikoo – free shared Pomodoro timer to study and work together";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage("Focus together. Instantly.", "Create a room, share the link, and study or work with friends on one synced Pomodoro timer.");
}
