"use client";

import { useEffect, useRef, useState } from "react";
import { IDEAS, LATEST_SHIPPED, SHIPPED, shortDate, type ShippedItem } from "@/lib/whatsNew";
import { getIdeaVotes, voteIdea } from "@/lib/api";
import { useStoredValue } from "@/lib/hooks/useStoredValue";
import { getUserId } from "@/components/NamePrompt";
import { SuggestionButton } from "@/components/SuggestionButton";
import { trace } from "@/lib/trace";

const SEEN_KEY = "pikoo:whats-new-seen";
// Each list shows this many, then "Show N more"
const SHOW = 5;

/** A dot until this browser has opened the panel since the newest SHIPPED entry */
export function useWhatsNewUnread(): [boolean, () => void] {
  // On the server (and before hydration) nothing is unread, so the dot never flashes wrongly
  const [seen, setSeen] = useStoredValue(SEEN_KEY, LATEST_SHIPPED);
  return [seen !== LATEST_SHIPPED, () => setSeen(LATEST_SHIPPED)];
}

export function UnreadDot({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block w-2 h-2 rounded-full bg-rose-400 ring-2 ring-black ${className}`} />;
}

/** The Features button's icon (sparkles) */
export function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function ShowMore({ hidden, expanded, onToggle }: { hidden: number; expanded: boolean; onToggle: () => void }) {
  if (hidden <= 0) return null;
  return (
    <button
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-2 w-full h-9 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
    >
      {expanded ? "Show fewer" : `Show ${hidden} more`}
    </button>
  );
}

interface WhatsNewPanelProps {
  open: boolean;
  onClose: () => void;
  where: "home" | "room";
  roomId?: string;
  name?: string | null;
  /** In a room: open the music menu or theme picker for a "Try it" */
  onRoomAction?: (action: NonNullable<ShippedItem["roomAction"]>) => void;
}

// "Features" side panel: first the most wanted features to vote on (and a way to
// send an idea), then below them what shipped lately. Each list shows 5 with
// "Show more". Opened only by the person; it never opens on its own.
export function WhatsNewPanel({ open, onClose, where, roomId, name, onRoomAction }: WhatsNewPanelProps) {
  const [, markSeen] = useWhatsNewUnread();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>(IDEAS.map((i) => i.id));
  const [loadFailed, setLoadFailed] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [showIdea, setShowIdea] = useState(false);
  const [allIdeas, setAllIdeas] = useState(false);
  const [allShipped, setAllShipped] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Opening: mark as read, log it, load the votes (sorted most wanted first, once per opening)
  useEffect(() => {
    if (!open) return;
    markSeen();
    trace("whats_new", { where });
    closeRef.current?.focus();
    let cancelled = false;
    getIdeaVotes(getUserId())
      .then(({ counts, mine }) => {
        if (cancelled) return;
        setCounts(counts);
        setMine(new Set(mine));
        setOrder(IDEAS.map((i) => i.id).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)));
        setLoadFailed(false);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
    // markSeen is a new function every render; opening is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, where]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !showIdea) onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose, showIdea]);

  if (!open) return null;

  const toggleVote = async (id: string) => {
    const on = !mine.has(id);
    const prevCount = counts[id] ?? 0;
    setVoteError(null);
    setMine((m) => { const n = new Set(m); if (on) n.add(id); else n.delete(id); return n; });
    setCounts((c) => ({ ...c, [id]: Math.max(0, prevCount + (on ? 1 : -1)) }));
    try {
      const count = await voteIdea(id, getUserId(), on);
      setCounts((c) => ({ ...c, [id]: count }));
    } catch (err) {
      setMine((m) => { const n = new Set(m); if (on) n.delete(id); else n.add(id); return n; });
      setCounts((c) => ({ ...c, [id]: prevCount }));
      setVoteError(err instanceof Error ? err.message : "Couldn't save your vote");
    }
  };

  const tryIt = (item: ShippedItem) => {
    trace("click", { what: "whats_new_try", item: item.id });
    if (where === "room" && item.roomAction) {
      onClose();
      onRoomAction?.(item.roomAction);
      return;
    }
    if (!item.href) return;
    if (where === "home" && item.href.startsWith("/#")) {
      onClose();
      const target = document.getElementById(item.href.slice(2));
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      return;
    }
    // From a room, pages open in a new tab so nobody gets pulled out of their session
    if (where === "room") window.open(item.href, "_blank", "noopener");
    else window.location.href = item.href;
  };

  const canTry = (item: ShippedItem) => (where === "room" ? !!(item.roomAction || item.href) : !!item.href);
  const more = (list: "ideas" | "shipped", expanded: boolean, set: (v: boolean) => void) => () => {
    if (!expanded) trace("click", { what: "features_more", list });
    set(!expanded);
  };
  const ideasShown = allIdeas ? order : order.slice(0, SHOW);
  const shippedShown = allShipped ? SHIPPED : SHIPPED.slice(0, SHOW);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="features-title"
        className="fixed z-50 inset-y-0 right-0 w-full sm:w-[26rem] flex flex-col bg-neutral-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl text-white animate-fade-in"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 id="features-title" className="text-lg font-semibold tracking-tight">Features</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <section aria-labelledby="wanted-title">
            <h3 id="wanted-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Most wanted features</h3>
            <p className="mt-1.5 text-sm text-white/55">Vote for what we build next. You can vote for as many as you like.</p>
            {loadFailed && <p className="mt-2 text-xs text-amber-300/80">Couldn&apos;t load the votes right now. Your vote still counts.</p>}
            {voteError && <p className="mt-2 text-xs text-rose-300">{voteError}</p>}
            <ul className="mt-3 space-y-2">
              {ideasShown.map((id) => {
                const idea = IDEAS.find((i) => i.id === id);
                if (!idea) return null;
                const voted = mine.has(id);
                const count = counts[id] ?? 0;
                return (
                  <li key={id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                    <span aria-hidden className="text-lg leading-6">{idea.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white/90 leading-6">{idea.title}</p>
                      <p className="mt-0.5 text-sm text-white/55 leading-snug">{idea.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleVote(id)}
                      aria-pressed={voted}
                      aria-label={`${voted ? "Remove your vote for" : "Vote for"} ${idea.title}${count ? ` (${count} ${count === 1 ? "vote" : "votes"})` : ""}`}
                      className={`shrink-0 h-9 min-w-[3.75rem] px-2.5 flex items-center justify-center gap-1.5 rounded-full border text-sm font-medium tabular-nums transition-colors ${
                        voted
                          ? "border-rose-400/60 bg-rose-500/20 text-rose-100"
                          : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span aria-hidden>👍</span>
                      {count > 0 ? count : voted ? "" : "Vote"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <ShowMore hidden={order.length - SHOW} expanded={allIdeas} onToggle={more("ideas", allIdeas, setAllIdeas)} />
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-3.5 py-2.5">
              <p className="text-sm text-white/70">Don&apos;t see your idea?</p>
              <button
                onClick={() => { trace("click", { what: "whats_new_idea" }); setShowIdea(true); }}
                className="shrink-0 h-8 px-3.5 rounded-full bg-rose-500 hover:bg-rose-400 text-sm font-medium transition-colors"
              >
                Share an idea
              </button>
            </div>
          </section>


          <section aria-labelledby="shipped-title" className="mt-8">
            <h3 id="shipped-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">What&apos;s new</h3>
            <ul className="mt-3 space-y-2.5">
              {shippedShown.map((item) => (
                <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-white/90">{item.title}</p>
                    <span className="shrink-0 text-xs text-white/40 tabular-nums">{shortDate(item.date)}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/60 leading-relaxed">{item.desc}</p>
                  {canTry(item) && (
                    <button onClick={() => tryIt(item)} className="mt-2 text-sm text-rose-300 hover:text-rose-200">
                      Try it →
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <ShowMore hidden={SHIPPED.length - SHOW} expanded={allShipped} onToggle={more("shipped", allShipped, setAllShipped)} />
          </section>
        </div>
      </aside>
      <SuggestionButton roomId={roomId} name={name} open={showIdea} onClose={() => setShowIdea(false)} />
    </>
  );
}

/** Homepage: the top-right "Features" button and its panel */
export function WhatsNewButton() {
  const [open, setOpen] = useState(false);
  const [unread] = useWhatsNewUnread();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative h-9 px-3.5 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-sm text-white/80 hover:text-white hover:bg-black/70 transition-colors"
      >
        <span aria-hidden>✨</span>
        Features
        {unread && <UnreadDot className="absolute -top-0.5 -right-0.5" />}
        {unread && <span className="sr-only">(new updates)</span>}
      </button>
      <WhatsNewPanel open={open} onClose={() => setOpen(false)} where="home" />
    </>
  );
}
