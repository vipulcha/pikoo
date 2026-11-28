"use client";

import { trace } from "@/lib/trace";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toRoomName } from "@/lib/roomNames";

// Accepts a full room link (https://<site>/r/abc123), a typed-name link
// (<site>/study-buddies), or just the code or name (abc123, Study Buddies)
function parseRoomId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/r\/([A-Za-z0-9_-]+)/) ?? trimmed.match(/^(?:https?:\/\/)?[^/\s]*[.:][^/\s]*\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  const roomId = match ? match[1] : trimmed.includes(" ") ? toRoomName(trimmed) : trimmed;
  return /^[A-Za-z0-9_-]{1,40}$/.test(roomId) ? roomId : null;
}

export function JoinRoomForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roomId = parseRoomId(value);
    trace("join_form", { input: value.trim().slice(0, 80), ok: roomId ? "yes" : "no" });
    if (!roomId) {
      setError("That doesn't look like a room link, code or name");
      return;
    }
    router.push(`/r/${roomId}`);
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
