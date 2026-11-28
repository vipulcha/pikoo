"use client";

import { useEffect, useRef, useState } from "react";
import { nextTip, Tip, TipContext, TipId, TIPS, TIPS_OFF_KEY } from "@/lib/tips";
import { useStoredValue } from "@/lib/hooks/useStoredValue";
import { trace } from "@/lib/trace";

const TOO_SHORT = "(max-width: 639px) and (max-height: 659px)";

interface RoomTipsProps {
  /** A break or a paused timer, with no dialog open. Never true during a running focus block. */
  visible: boolean;
  ctx: TipContext;
  onAction: (id: TipId) => void;
}

// One short tip at the bottom of the room: a new one each time a break starts or
// the timer is paused, gone as soon as focus runs again. × turns tips off for good.
export function RoomTips({ visible, ctx, onAction }: RoomTipsProps) {
  const [off, setOff] = useStoredValue(TIPS_OFF_KEY);
  const [tip, setTip] = useState<Tip | null>(null);
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; });

  // Pick a tip shortly after the break or pause starts, so quick skips don't flash one.
  // Short phone screens get none: there the room already fills the screen and a tip
  // would cover a control.
  useEffect(() => {
    if (!visible || off) return;
    const t = setTimeout(() => {
      if (window.matchMedia(TOO_SHORT).matches) return;
      const next = nextTip(ctxRef.current);
      setTip(next);
      if (next) trace("tip", { id: next.id, act: "shown" });
    }, 1200);
    return () => {
      clearTimeout(t);
      setTip(null);
    };
  }, [visible, off]);

  // Hide it once it no longer applies (e.g. Auto-start was just turned on)
  const current = tip && TIPS.find((t) => t.id === tip.id);
  if (!visible || off || !tip || !current?.when(ctx)) return null;

  return (
    <div
      role="note"
      aria-label="Tip"
      className="fixed z-20 left-3 right-3 bottom-[3.75rem] sm:left-1/2 sm:right-auto sm:bottom-4 sm:-translate-x-1/2 sm:w-max sm:max-w-[min(46rem,calc(100vw-22rem))] animate-fade-in"
    >
      <div className="flex items-center gap-2 sm:gap-3 rounded-2xl sm:rounded-full bg-black/60 backdrop-blur-md border border-white/10 pl-3 sm:pl-4 pr-1 sm:pr-1.5 py-1 sm:py-1.5 text-[13px] sm:text-sm text-white/80 shadow-lg">
        <span aria-hidden className="shrink-0 hidden sm:inline">💡</span>
        <span className="min-w-0 leading-snug">{tip.text}</span>
        {tip.action && (
          <button
            type="button"
            onClick={() => {
              trace("tip", { id: tip.id, act: "click" });
              onAction(tip.id);
              setTip(null);
            }}
            className="shrink-0 h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-[13px] font-medium transition-colors"
          >
            {tip.action}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            trace("tip", { act: "off", id: tip.id });
            setOff("1");
          }}
          title="Don't show tips"
          aria-label="Don't show tips"
          className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
