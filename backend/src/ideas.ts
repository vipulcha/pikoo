// ============================================
// "Most wanted features" votes (the Features panel)
// ============================================
// One vote per browser per idea. Stored as a Redis set per idea holding a hash
// of the browser id (never the id itself), so a vote can be taken back and a
// browser can't vote twice.

import { createHash } from "crypto";
import { getRedis } from "./store.js";

// Keep in sync with frontend/src/lib/whatsNew.ts
export const IDEA_IDS = [
  "own-music",
  "mini-timer",
  "block-sites",
  "focus-history",
  "voice-breaks",
  "install-app",
  "sound-mixer",
] as const;
export type IdeaId = (typeof IDEA_IDS)[number];

export const isIdeaId = (id: unknown): id is IdeaId => typeof id === "string" && (IDEA_IDS as readonly string[]).includes(id);

const key = (id: IdeaId) => `idea_votes:${id}`;
const voterHash = (uniqueId: string) => createHash("sha256").update(`idea:${uniqueId}`).digest("hex").slice(0, 20);

const memoryVotes = new Map<IdeaId, Set<string>>();

/** Adds or takes back one browser's vote; returns the idea's new count and whether anything changed */
export async function voteIdea(id: IdeaId, uniqueId: string, on: boolean): Promise<{ count: number; changed: boolean }> {
  const voter = voterHash(uniqueId);
  const redis = getRedis();
  if (redis) {
    const [changed, count] = (await redis.multi()[on ? "sadd" : "srem"](key(id), voter).scard(key(id)).exec()) ?? [];
    return { count: Number(count?.[1] ?? 0), changed: Number(changed?.[1] ?? 0) === 1 };
  }
  let set = memoryVotes.get(id);
  if (!set) memoryVotes.set(id, (set = new Set()));
  const had = set.has(voter);
  if (on) set.add(voter);
  else set.delete(voter);
  return { count: set.size, changed: had !== on };
}

/** Vote count per idea, plus which ideas this browser voted for (if given) */
export async function ideaVotes(uniqueId?: string): Promise<{ counts: Record<IdeaId, number>; mine: IdeaId[] }> {
  const voter = uniqueId ? voterHash(uniqueId) : null;
  const counts = {} as Record<IdeaId, number>;
  const mine: IdeaId[] = [];
  const redis = getRedis();
  if (redis) {
    const pipe = redis.pipeline();
    for (const id of IDEA_IDS) {
      pipe.scard(key(id));
      if (voter) pipe.sismember(key(id), voter);
    }
    const res = (await pipe.exec()) ?? [];
    let i = 0;
    for (const id of IDEA_IDS) {
      counts[id] = Number(res[i++]?.[1] ?? 0);
      if (voter && Number(res[i++]?.[1] ?? 0) === 1) mine.push(id);
    }
  } else {
    for (const id of IDEA_IDS) {
      const set = memoryVotes.get(id);
      counts[id] = set?.size ?? 0;
      if (voter && set?.has(voter)) mine.push(id);
    }
  }
  return { counts, mine };
}
