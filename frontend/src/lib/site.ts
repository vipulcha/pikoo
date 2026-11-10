// Single source of truth for the public site URL and shared copy.
// Set NEXT_PUBLIC_SITE_URL in Vercel when the app moves to its own domain;
// every canonical URL, sitemap entry and share image follows it.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://pikoo-nu.vercel.app").replace(/\/+$/, "");

export const SITE_NAME = "Pikoo";

export const SITE_TITLE = "Pikoo – Free Shared Pomodoro Timer to Study & Work Together";

export const SITE_TAGLINE = "Focus together. Instantly.";

// ~155 characters: fits in search results without being cut off
export const SITE_DESCRIPTION =
  "Free online Pomodoro timer you can share. Create a focus room, send the link, and study or work with friends on one synced timer. No sign-up needed.";

// A self-contained answer to "What is Pikoo?", written so search engines and AI assistants can quote it directly
export const SITE_SUMMARY =
  "Pikoo is a free, browser-based shared Pomodoro timer. You create a focus room, share its link, and everyone in the room sees the same synchronized timer, along with session goals, built-in focus sounds and a room chat. It needs no account or download and works on desktop and mobile.";

export const FEATURE_LIST = [
  "Shared Pomodoro timer synchronized in real time for everyone in the room",
  "Custom focus (5–60 min), break (1–30 min) and long break (5–45 min) lengths",
  "Quick +5 / +10 minute and custom time extensions",
  "Optional auto-start of the next focus or break",
  "Collaborative mode (anyone controls the timer) or host-only mode",
  "Session goals and to-do list, shared with the room or kept private",
  "Built-in lo-fi, rain, café, white, brown and pink noise focus sounds",
  "Room chat and a live count of who is in the room",
  "Keyboard shortcuts: Space to start or pause, R to reset, S to skip",
  "No sign-up, no download, free",
];

export const absoluteUrl = (path = "/") => `${SITE_URL}${path === "/" ? "" : path}`;
