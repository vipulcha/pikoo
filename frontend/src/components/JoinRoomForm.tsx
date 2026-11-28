"use client";

import { trace } from "@/lib/trace";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toRoomName } from "@/lib/roomNames";

const ROOM_ID = /^[A-Za-z0-9_-]{1,40}$/;

// Where the join box goes.
// - What it has always accepted goes to /r/<code>, exactly as before: a room link
//   (https://<site>/r/abc123, with or without extra text around it) or a bare code.
// - New: a typed-name link (<site>/study-buddies) or a name with spaces (Study
//   Buddies) goes to /<name>, which looks the name up (see components/MissingRoom).
function parseRoomPath(input: string): string | null {
  const trimmed = input.trim();
  const roomLink = trimmed.match(/\/r\/([A-Za-z0-9_-]+)/);
  if (roomLink) return ROOM_ID.test(roomLink[1]) ? `/r/${roomLink[1]}` : null;
  if (ROOM_ID.test(trimmed)) return `/r/${trimmed}`;
  const nameLink = trimmed.match(/^(?:https?:\/\/)?[^/\s]*[.:][^/\s]*\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  const name = nameLink ? nameLink[1] : trimmed.includes(" ") ? toRoomName(trimmed) : null;
  return name && ROOM_ID.test(name) ? `/${name}` : null;
}

export function JoinRoomForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const path = parseRoomPath(value);
    trace("join_form", { input: value.trim().slice(0, 80), ok: path ? "yes" : "no", to: path ?? undefined });
    if (!path) {
      setError("That doesn't look like a room link, code or name");
      return;
    }
    router.push(path);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Room link, code or name"
          aria-label="Room link, code or name"
          className="flex-1 min-w-0 px-4 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30 transition-colors"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="px-5 py-2.5 rounded-full text-sm font-medium bg-white/10 border border-white/10 text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Join
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-400 text-center">{error}</p>}
    </form>
  );
}
