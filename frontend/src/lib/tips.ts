// Tips shown in rooms during breaks and while the timer is paused (never during
// focus). Each one points at something that already exists in the room; the
// button opens or highlights it (see RoomScreen's handleTipAction).

export type TipId =
  | "autostart" | "space" | "addtime" | "schedule" | "leaderboard" | "privacy"
  | "music" | "theme" | "notify" | "embed" | "silent";

export interface TipContext {
  /** This person can change the timer (not a visitor in a host-only room) */
  canControl: boolean;
  autoStart: boolean;
  hasSchedule: boolean;
  /** They have tasks and others can see them */
  tasksVisible: boolean;
  notify: NotificationPermission | "unsupported";
  /** A computer with a keyboard (Space shortcut) */
  desktop: boolean;
  /** The work-with-dev room */
  dev: boolean;
}

export interface Tip {
  id: TipId;
  text: string;
  /** Button label; no button when the tip has nothing to open */
  action?: string;
  when: (c: TipContext) => boolean;
}

export const TIPS: Tip[] = [
  { id: "autostart", text: "Let breaks and focus start on their own: turn on Auto-start.", action: "Show me", when: (c) => c.canControl && !c.autoStart },
  { id: "space", text: "Press Space to start or pause the timer.", when: (c) => c.canControl && c.desktop },
  { id: "addtime", text: "Need a few more minutes? +5 min stretches the current block.", action: "Show me", when: (c) => c.canControl },
  { id: "schedule", text: "Schedule a regular session and add it to everyone's calendar.", action: "Show me", when: (c) => c.canControl && !c.hasSchedule && !c.dev },
  { id: "leaderboard", text: "See who focused most in this room this week.", action: "Show me", when: () => true },
  { id: "privacy", text: "Your tasks are visible to the room. Tap the eye to hide them.", action: "Show me", when: (c) => c.tasksVisible },
  { id: "music", text: "Play lo-fi radio, rain or café sounds while you work.", action: "Show me", when: () => true },
  { id: "theme", text: "Pick a different background for your screen.", action: "Show me", when: () => true },
  { id: "notify", text: "Get a notification when a session ends, even in another tab.", action: "Turn on", when: (c) => c.notify === "default" },
  { id: "embed", text: "Put this timer in your Notion page or on your stream.", action: "Show me", when: (c) => !c.dev },
  { id: "silent", text: "Want company without chat? Try the silent study rooms.", action: "Open", when: (c) => !c.dev },
];

const SEEN_KEY = "pikoo:tips-seen";
export const TIPS_OFF_KEY = "pikoo:tips-off";

/**
 * The next tip for this browser: the first one that applies and hasn't been shown
 * yet; once all have been shown, start over (never the same tip twice in a row).
 */
export function nextTip(ctx: TipContext): Tip | null {
  const eligible = TIPS.filter((t) => t.when(ctx));
  if (!eligible.length) return null;
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { seen = []; }
  if (!Array.isArray(seen)) seen = [];
  let tip = eligible.find((t) => !seen.includes(t.id));
  if (!tip) {
    const last = seen[seen.length - 1];
    tip = eligible.find((t) => t.id !== last) ?? eligible[0];
    seen = [];
  }
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, tip.id])); } catch { /* storage blocked */ }
  return tip;
}

/** Briefly rings the (visible) element marked data-tip="<name>" */
export function spotlight(name: string, delayMs = 80): void {
  setTimeout(() => {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tip="${name}"]`)].find((e) => e.getClientRects().length > 0);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("tip-spotlight");
    void el.offsetWidth; // restart the animation
    el.classList.add("tip-spotlight");
    setTimeout(() => el.classList.remove("tip-spotlight"), 3800);
  }, delayMs);
}
