// Presets for the /timer/<slug> pages: simple timers that start instantly for
// one person and can be turned into a shared room. Each has its own copy so the
// pages aren't near-duplicates.

export interface TimerPreset {
  slug: string;
  focusMin: number;
  breakMin: number | null; // null = a single countdown
  label: string;           // "25 Minute Timer"
  intro: string;           // first paragraph, answers the search directly
  uses: string[];
  // Optional extra copy for presets people search for by name
  title?: string;          // <title>, ~60 chars
  description?: string;    // meta description, ~155 chars
  details?: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
  faqs?: { q: string; a: string }[];
}

const single = (min: number, intro: string, uses: string[]): TimerPreset => ({
  slug: `${min}-minutes`,
  focusMin: min,
  breakMin: null,
  label: `${min} Minute Timer`,
  intro,
  uses,
});

const pomo = (f: number, b: number, label: string, intro: string, uses: string[]): TimerPreset => ({
  slug: `${f}-${b}`,
  focusMin: f,
  breakMin: b,
  label,
  intro,
  uses,
});

export const TIMER_PRESETS: TimerPreset[] = [
  single(5, "A free 5 minute timer that starts with one click. Five minutes is long enough to get unstuck on something you've been avoiding, and short enough that starting feels easy.", ["The \"just 5 minutes\" trick for procrastination", "A quick tidy-up or inbox sweep", "Short stretch or breathing break"]),
  single(10, "A free 10 minute timer for short, focused bursts. Ten minutes works well for small tasks, quick reviews and timed practice.", ["Reviewing flashcards", "A 10-minute writing sprint", "Timed practice questions"]),
  single(15, "A free 15 minute timer, a good size for a short sprint when a full Pomodoro feels like too much.", ["Starting a task you've been putting off", "One section of reading", "Stand-up meetings that stay short"]),
  single(20, "A free 20 minute timer for medium-length focus blocks, a little shorter than a classic Pomodoro.", ["Focused reading", "Solving a problem set question", "A power nap (set it slightly longer than you plan to sleep)"]),
  single(25, "A free 25 minute timer, the length of one classic Pomodoro. Work on a single task until it ends, then take a 5-minute break.", ["One Pomodoro session", "Deep work on a single task", "Studying one topic without distractions"]),
  single(30, "A free 30 minute timer for half-hour focus blocks.", ["Half-hour study sessions", "Workouts and practice", "Timeboxing a meeting or task"]),
  single(45, "A free 45 minute timer, close to the length of a school lesson or an exam section.", ["Mock exam sections", "Longer reading or writing blocks", "Practising for a timed test"]),
  single(60, "A free 60 minute timer (one hour) for long focus blocks and timed practice exams.", ["Full practice papers", "Deep work on a hard problem", "One-hour coworking sessions"]),
  single(90, "A free 90 minute timer, matching one long deep-work cycle.", ["Ultradian 90-minute deep work", "Long exam simulations", "Writing or coding marathons"]),
  pomo(25, 5, "Pomodoro Timer 25/5", "The classic Pomodoro timer: 25 minutes of focus, then a 5-minute break, repeating. After four sessions, take a longer break.", ["Studying and homework", "Any task that needs steady focus", "Beating procrastination"]),
  {
    ...pomo(50, 10, "50/10 Pomodoro Timer", "A 50/10 timer: 50 minutes of focus followed by a 10-minute break. Popular for deep work, where 25 minutes ends just as you get going.", ["Deep work and long reading", "Coding and writing", "Exam revision blocks"]),
    title: "50/10 Timer – Free 50 Minute Pomodoro With 10 Minute Breaks",
    description: "A free 50/10 Pomodoro timer: 50 minutes of focus, then a 10-minute break, repeating. Starts instantly with no sign-up. Use it alone or study 50/10 with others.",
    details: [
      {
        heading: "How the 50/10 method works",
        paragraphs: [
          "Work on one task for 50 minutes, then take a 10-minute break away from the screen. Each cycle takes exactly an hour, so it's easy to line up with the clock and plan a day around.",
          "After three or four cycles, take a longer break of 20 to 30 minutes. Before each block, write down the one thing you'll work on, so you don't spend the first few minutes deciding.",
        ],
      },
      {
        heading: "50/10 vs 25/5",
        paragraphs: [
          "Both give you five minutes of focus for every minute of rest. The difference is how often you stop. A 25/5 timer breaks every half hour, which helps when a task is hard to start. A 50/10 timer gives you one break an hour, which suits work with a long warm-up, like reading, writing, coding or problem sets, where a break at 25 minutes cuts you off just as you get going.",
          "If 50 minutes feels too long, start with 25/5 and move up once focusing gets easier.",
        ],
      },
      {
        heading: "A 50/10 study day",
        bullets: [
          "Four cycles give you 3 hours 20 minutes of focus in 4 hours.",
          "Take a 30-minute break after the second or third cycle.",
          "Use the 10 minutes to stand up, drink water or step outside, not to check messages.",
          "If you get pulled away mid-block, restart the timer rather than counting a broken block.",
        ],
      },
    ],
    faqs: [
      { q: "Is 50/10 better than 25/5?", a: "Neither is better for everyone. 50/10 suits tasks that take a while to get into; 25/5 suits tasks you keep avoiding or days when focus is low. Both keep the same five-to-one ratio of focus to rest." },
      { q: "How many 50/10 sessions should I do in a day?", a: "There's no fixed number. Four cycles give you over three hours of focused work, which is a solid day of hard study or deep work. Take a longer break after every three or four." },
    ],
  },
  pomo(52, 17, "52/17 Timer", "A 52/17 timer: 52 minutes of work followed by a 17-minute break, a rhythm popularised by a DeskTime study of how its most productive users worked.", ["Knowledge work", "Long study days", "Keeping energy steady across the day"]),
  pomo(90, 20, "90/20 Deep Work Timer", "A 90/20 timer: 90 minutes of deep work followed by a 20-minute break, based on the roughly 90-minute focus cycles many people notice in themselves.", ["Very deep, uninterrupted work", "Long writing or research sessions", "Weekend study marathons"]),
];

export const getTimerPreset = (slug: string) => TIMER_PRESETS.find((t) => t.slug === slug);
