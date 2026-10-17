"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Accepts a full room link (https://pikoo.live/r/abc123) or just the code (abc123)
function parseRoomId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/r\/([A-Za-z0-9_-]+)/);
  const roomId = match ? match[1] : trimmed;
  return /^[A-Za-z0-9_-]{1,21}$/.test(roomId) ? roomId : null;
}

export function JoinRoomForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roomId = parseRoomId(value);
    if (!roomId) {
      setError("That doesn't look like a room link or code");
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
          placeholder="Paste a room link or code"
          aria-label="Room link or code"
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
