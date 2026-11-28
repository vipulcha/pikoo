// Content for the Features panel (its "What's new" list). Add a line to SHIPPED (newest first) whenever
// something people can notice ships; developer-only changes don't go here.
// A new first entry turns the unread dot back on for everyone.

export interface ShippedItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  desc: string;
  /** A page to try it on (opens in a new tab from inside a room) */
  href?: string;
  /** Something to open inside a room instead of a page */
  roomAction?: "theme" | "music";
}

export const SHIPPED: ShippedItem[] = [
  {
    id: "work-with-dev",
    date: "2026-11-28",
    title: "Work with the developer",
    desc: "A public room that opens whenever Pikoo's developer is working. Drop in and focus together.",
    href: "/work-with-dev",
  },
  {
    id: "room-themes",
    date: "2026-11-18",
    title: "Room backgrounds",
    desc: "Space, forest, ocean, mountains and more. Pick one from the Theme button in any room.",
    roomAction: "theme",
  },
  {
    id: "obs-task",
    date: "2026-11-18",
    title: "Your task on stream",
    desc: "The OBS timer overlay now shows what you're working on and how many tasks are done.",
    href: "/obs",
  },
  {
    id: "exam-rooms",
    date: "2026-11-11",
    title: "Exam rooms",
    desc: "Silent rooms for JEE, NEET, UPSC, SAT, AP, A-levels, IB and more, with a countdown to exam day.",
    href: "/library#exams",
  },
  {
    id: "lofi-radio",
    date: "2026-11-10",
    title: "Live lo-fi radio",
    desc: "24/7 lo-fi stations right in the Music menu, next to rain, café and noise sounds.",
    roomAction: "music",
  },
];

export const LATEST_SHIPPED = SHIPPED[0].id;

// Keep the ids in sync with backend/src/ideas.ts
export interface Idea {
  id: string;
  emoji: string;
  title: string;
  desc: string;
}

export const IDEAS: Idea[] = [
  { id: "own-music", emoji: "🎵", title: "Your own Spotify or Apple Music playlist", desc: "Play your own playlist inside Pikoo instead of switching apps." },
  { id: "mini-timer", emoji: "🪟", title: "Floating mini-timer", desc: "A small timer that stays on top of your other apps while you work." },
  { id: "block-sites", emoji: "🚫", title: "Block distracting sites during focus", desc: "YouTube, Instagram and the rest blocked only while your room is in focus." },
  { id: "focus-history", emoji: "📈", title: "Your focus history and streaks", desc: "Your focus time across days and rooms, with a streak to keep going." },
  { id: "voice-breaks", emoji: "🎙️", title: "Voice chat in breaks", desc: "A quick voice call that opens only in breaks and closes when focus starts." },
  { id: "install-app", emoji: "📱", title: "Install Pikoo on your phone", desc: "Add it to your home screen, with a lock-screen alert when a session ends." },
  { id: "sound-mixer", emoji: "🎚️", title: "Mix your own background sound", desc: "Rain, café chatter and lo-fi together, each with its own volume." },
];

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
