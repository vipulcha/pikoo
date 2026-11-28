"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { resolveRoom, roomExists, roomNameProblem, toRoomName } from "@/lib/roomNames";
import { getUserId } from "@/components/NamePrompt";
import { StarField } from "@/components/RoomBackground";
import { trace } from "@/lib/trace";

interface MissingRoomProps {
  /** What was in the address, e.g. "WorkBuddys" from pikoo…/WorkBuddys or /r/WorkBuddys */
  name: string;
  /** Typed as pikoo…/<name> (no /r/), so it's meant as a room name */
  short: boolean;
  /** Page names a room can't take (guides), from the server */
  reserved?: readonly string[];
}

// A typed room name or a room link that didn't lead to a room.
// - Typed name (pikoo…/<name>): looked up exact, then lowercase, then as a room
//   name; goes there if found, otherwise offers to create it in one click.
// - Room link (/r/<code>): only the exact code is checked again (an /r/ link must
//   never land in a different room); if it exists now, the page reloads into it.
export function MissingRoom({ name, short, reserved = [] }: MissingRoomProps) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "missing" | "offline">("checking");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState("");

  const candidate = toRoomName(name);
  const problem = roomNameProblem(candidate, reserved);
  // From /r/<code>, only offer a name that's already written as one: a mixed-case
  // code like 9d4dJkC9-t is an old room, not a name someone chose
  const canCreate = !problem && (short || name === candidate);

  useEffect(() => {
    let cancelled = false;
    setTimeout(() => { if (!cancelled) setHost(window.location.host); }, 0);
    const lookup = short
      ? resolveRoom(name)
      : roomExists(name).then((found) => ({ id: found ? name : null, failed: found === null }));
    lookup.then(({ id, failed }) => {
      if (cancelled) return;
      const found = id ? "yes" : failed ? "offline" : "no";
      if (short) trace("short_link", { name: name.slice(0, 40), found });
      else trace("missing_room", { code: name.slice(0, 40), found });
      if (id && (short || id !== name)) router.replace(`/r/${id}`);
      else if (id) window.location.reload(); // created a moment ago: join it
      else setState(failed ? "offline" : "missing");
    });
    return () => { cancelled = true; };
  }, [name, short, router]);

  const create = async () => {
    setCreating(true);
    setError(null);
    trace("create_room", { custom: "no", slug: candidate, from: short ? "typed_name" : "missing_room" });
    try {
      const { roomId } = await createRoom(undefined, getUserId(), candidate);
      router.replace(`/r/${roomId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Someone created it a moment ago: just go in
      if (/taken/i.test(msg)) router.replace(`/r/${candidate}`);
      else {
        setError(msg || "Couldn't create the room. Please try again.");
        setCreating(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <StarField />
      </div>
      <div className="relative z-10 w-full max-w-md text-center">
        {state === "checking" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
            <p className="text-white/60">Looking for that room…</p>
          </div>
        ) : state === "offline" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t reach Pikoo</h1>
            <p className="mt-3 text-white/60">Check your connection and try again.</p>
            <button onClick={() => window.location.reload()} className="mt-6 h-11 px-6 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 font-medium">
              Try again
            </button>
          </>
        ) : canCreate ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/90">Free room name</p>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight break-words">
              No room called &ldquo;{candidate}&rdquo; yet
            </h1>
            <p className="mt-3 text-white/60 leading-relaxed">
              Create it and it&apos;s yours. Anyone who types this link will join you:
            </p>
            <p className="mt-2 font-mono text-sm text-white/85 break-all">{host || "pikoo"}/{candidate}</p>
            <button
              onClick={create}
              disabled={creating}
              className="mt-7 w-full max-w-xs h-12 rounded-full font-semibold bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 disabled:opacity-50 shadow-xl shadow-rose-500/30 transition-colors"
            >
              {creating ? "Creating…" : `Create “${candidate}”`}
            </button>
            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
            <p className="mt-6 text-sm">
              <Link href="/" className="text-white/50 hover:text-white">Go to the homepage</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{short ? "Page not found" : "Room not found"}</h1>
            <p className="mt-3 text-white/60 leading-relaxed">
              {short
                ? "There's no page or room at this address."
                : "This room doesn't exist. Rooms close after 30 days without anyone using them."}
            </p>
            <Link
              href="/"
              className="mt-7 inline-flex items-center justify-center h-12 px-8 rounded-full font-semibold bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 shadow-xl shadow-rose-500/30"
            >
              Create a new room
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
