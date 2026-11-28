import type { Metadata } from "next";
import { GUIDES } from "@/lib/guides";
import { NotFoundView } from "./NotFoundView";

export const metadata: Metadata = {
  title: { absolute: "Not found · Pikoo" },
  robots: { index: false, follow: false },
};

// Unknown addresses. A single word like pikoo…/study-buddies is treated as a room
// name: it goes to that room if it exists, or offers to create it.
export default function NotFound() {
  return <NotFoundView reserved={GUIDES.map((g) => g.slug)} />;
}
