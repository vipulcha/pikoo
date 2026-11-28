"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RoomScreen } from "@/components/RoomScreen";
import { DEV_ROOM_ID, DEV_PATH } from "@/lib/devRoom";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params);
  const router = useRouter();
  const isDevRoom = roomId === DEV_ROOM_ID;

  // The work-with-dev room has its own page
  useEffect(() => {
    if (isDevRoom) router.replace(DEV_PATH);
  }, [isDevRoom, router]);
  if (isDevRoom) return <div className="min-h-screen bg-black" />;

  return <RoomScreen roomId={roomId} />;
}
