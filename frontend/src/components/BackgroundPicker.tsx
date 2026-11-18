"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BACKGROUNDS, BackgroundGroup, BackgroundState, backgroundThumb, shrinkImage } from "@/lib/backgrounds";
import { trace } from "@/lib/trace";

const GROUPS: BackgroundGroup[] = ["Space & nature", "Cozy study", "Minimal"];

function Tile({ label, selected, onClick, children }: { label: string; selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative aspect-video rounded-lg overflow-hidden border transition-all ${selected ? "border-white ring-2 ring-white/70" : "border-white/10 hover:border-white/40"}`}
    >
      {children}
      <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[11px] font-medium text-left text-white bg-gradient-to-t from-black/80 to-transparent">
        {label}
      </span>
    </button>
  );
}

/** Header button (wider screens) + panel for picking this person's room background */
export function BackgroundPicker({ bg, open, setOpen }: { bg: BackgroundState; open: boolean; setOpen: (open: boolean) => void }) {
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, setOpen]);

  const pick = (id: string) => {
    bg.choose(id);
    trace("background", { pick: id });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      bg.setCustomImage(await shrinkImage(file));
      trace("background", { pick: "custom" });
    } catch {
      setError("That file isn't an image we can use.");
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => { if (!open) trace("click", { what: "background_button" }); setOpen(!open); }}
        title="Change background"
        aria-label="Theme"
        aria-expanded={open}
        className={`hidden sm:flex h-9 px-4 shrink-0 rounded-full transition-all duration-200 items-center gap-2 text-sm font-medium ${open ? "bg-white/20 text-white" : "bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10"}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <span>Theme</span>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Background"
          className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 max-h-[calc(100vh-6rem)] overflow-y-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 animate-fade-in"
          style={{ zIndex: 100 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Background</h3>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/50 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {GROUPS.map((group) => (
            <section key={group} className="mb-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/45">{group}</p>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUNDS.filter((b) => b.group === group).map((b) => {
                  const thumb = backgroundThumb(b);
                  return (
                    <Tile key={b.id} label={b.label} selected={bg.choice === b.id} onClick={() => pick(b.id)}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0" style={{ background: b.css }} />
                      )}
                    </Tile>
                  );
                })}
              </div>
            </section>
          ))}

          <section>
            <p className="mb-2 text-xs uppercase tracking-wider text-white/45">Your photo</p>
            <div className="grid grid-cols-2 gap-2">
              {bg.custom && (
                <Tile label="Your photo" selected={bg.choice === "custom"} onClick={() => pick("custom")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg.custom} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </Tile>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="aspect-video rounded-lg border border-dashed border-white/25 hover:border-white/50 text-xs text-white/70 hover:text-white flex items-center justify-center"
              >
                {bg.custom ? "Choose another" : "+ Choose a photo"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <p className="mt-2 text-xs text-white/40">Your photo stays on this device. It&apos;s never uploaded.</p>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Bottom-left button: next photo in the current theme (only for themes with several photos) */
export function NextWallpaperButton({ bg }: { bg: BackgroundState }) {
  const [loading, setLoading] = useState(false);
  if (bg.photoCount < 2) return null;
  const label = BACKGROUNDS.find((b) => b.id === bg.choice)?.label ?? "Wallpaper";
  const next = async () => {
    if (loading) return;
    setLoading(true);
    trace("background", { pick: bg.choice ?? "", photo: ((bg.photoIndex + 1) % bg.photoCount) + 1 });
    try { await bg.nextPhoto(); } finally { setLoading(false); }
  };
  return (
    <button
      onClick={next}
      title={`Next ${label.toLowerCase()} wallpaper (${bg.photoIndex + 1} of ${bg.photoCount})`}
      aria-label="Next wallpaper"
      className="fixed bottom-4 left-4 z-30 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white/75 hover:text-white hover:bg-black/60 flex items-center justify-center transition-colors"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        // A picture with a "refresh" arrow: swap this picture for another
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M13 18.5H4.5a2 2 0 01-2-2v-11a2 2 0 012-2h13a2 2 0 012 2V10" />
          <path d="M2.5 14.5l4.2-4.2a1.5 1.5 0 012.1 0l3.2 3.2" />
          <circle cx="14.5" cy="7.5" r="1.3" />
          <path d="M21.5 16.5a4 4 0 11-1.2-2.85" />
          <path d="M21.5 12.5v2.5H19" />
        </svg>
      )}
    </button>
  );
}
