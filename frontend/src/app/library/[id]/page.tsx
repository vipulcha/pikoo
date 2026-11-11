import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LIBRARY_ROOMS, getLibraryRoom } from "@/lib/library";
import { absoluteUrl } from "@/lib/site";
import { LibraryRoomView } from "./LibraryRoomView";

export const dynamicParams = false;
export const generateStaticParams = () => LIBRARY_ROOMS.map((r) => ({ id: r.id }));

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = getLibraryRoom((await params).id);
  if (!room) return {};
  const title = room.exam
    ? `${room.exam.name} Study Room – Live Countdown & ${room.focusMin}/${room.breakMin} Timer | Pikoo`
    : `${room.name} – Live ${room.focusMin}/${room.breakMin} Study Room | Pikoo`;
  const description = room.exam
    ? `Study for ${room.exam.name} alongside other aspirants in a free silent room with a countdown to exam day (${room.exam.dateLabel}). ${room.focusMin}-minute focus blocks, no chat, no sign-up.`
    : `Focus alongside others in a free silent study room: ${room.focusMin}-minute focus, ${room.breakMin}-minute breaks, sessions on the hour. No chat, no sign-up.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl(`/library/${room.id}`) },
    openGraph: { title, description, url: absoluteUrl(`/library/${room.id}`) },
  };
}

export default async function LibraryRoomPage({ params }: Props) {
  const room = getLibraryRoom((await params).id);
  if (!room) notFound();
  return <LibraryRoomView room={room} />;
}
