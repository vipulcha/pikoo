// Content for the search landing pages served at /<slug>.
// Each page targets one search intent, opens with a direct answer (for
// featured snippets and AI answers), and ends with an FAQ marked up as FAQPage.

export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  label: string;       // short name for links and breadcrumbs
  title: string;        // <title>, ~60 chars
  description: string;  // meta description, ~155 chars
  h1: string;
  answer: string;       // 40–70 word direct answer shown first
  sections: GuideSection[];
  steps?: { name: string; text: string }[];
  faqs: { q: string; a: string }[];
  related: string[];    // slugs
  updated: string;      // ISO date of last content edit
}

const UPDATED = "2026-11-09";

export const GUIDES: Guide[] = [
  {
    slug: "pomodoro-timer-with-friends",
    label: "Pomodoro timer with friends",
    title: "Pomodoro Timer With Friends – Free Shared Timer",
    description:
      "Run a Pomodoro timer with friends online. Create a free room, share the link, and everyone sees the same synced focus and break timer. No sign-up.",
    h1: "A Pomodoro timer you can share with friends",
    answer:
      "To use a Pomodoro timer with friends, open Pikoo, create a room and send the link. Everyone who opens it sees the same timer, synced in real time, so you all start focus sessions and breaks together. It's free, runs in the browser and needs no account.",
    steps: [
      { name: "Create a room", text: "Open Pikoo and press Create Room. Optionally set your focus, break and long break lengths first." },
      { name: "Share the link", text: "Copy the room link with the Share Link button and send it to your friends in any chat app." },
      { name: "Start the timer", text: "Press play (or Space). The countdown starts for everyone in the room at the same moment." },
      { name: "Take breaks together", text: "When focus ends the room moves to a break. Turn on auto-start to roll straight into the next session." },
    ],
    sections: [
      {
        heading: "Why use a shared timer instead of separate ones?",
        paragraphs: [
          "When everyone runs their own timer, breaks drift apart and nobody is free to talk at the same time. A shared timer keeps the whole group on one rhythm: you focus together, you rest together, and you check in during the same break.",
          "It also adds gentle accountability. Seeing other people in the room, and the goals they're working on, makes it harder to drift off to your phone.",
        ],
      },
      {
        heading: "What you can do in a Pikoo room",
        bullets: [
          "Set focus from 5 to 60 minutes, breaks from 1 to 30, and a long break after every 2 to 8 sessions.",
          "Add 5 or 10 minutes (or any amount) when you're in the flow and don't want to stop.",
          "Write session goals and choose whether the room can see them.",
          "Play lo-fi, rain, café or white, brown and pink noise without opening another tab.",
          "Chat with the room, especially during breaks.",
          "Switch to host-only mode if you'd rather one person controls the timer.",
        ],
      },
    ],
    faqs: [
      { q: "Is Pikoo free?", a: "Yes. Pikoo is free to use, with no account, trial or download." },
      { q: "Do my friends need to sign up?", a: "No. Anyone with the room link can join from a browser and pick a display name." },
      { q: "Does it work on phones?", a: "Yes. Pikoo works in mobile browsers on iOS and Android as well as on desktop." },
      { q: "Can I change the Pomodoro length?", a: "Yes. Focus can be 5–60 minutes, short breaks 1–30 minutes, long breaks 5–45 minutes, and you choose how many sessions come before a long break." },
      { q: "Who controls the timer?", a: "In collaborative mode anyone in the room can start, pause, skip or add time. In host mode only the person who created the room can." },
    ],
    related: ["online-study-room", "virtual-coworking", "pomodoro-technique"],
    updated: UPDATED,
  },
  {
    slug: "online-study-room",
    label: "Online study room",
    title: "Online Study Room – Study Together With a Timer",
    description:
      "Join or create a free online study room. Study with friends or classmates on one synced Pomodoro timer with goals, focus music and chat. No sign-up.",
    h1: "An online study room with a shared Pomodoro timer",
    answer:
      "An online study room is a virtual space where people study at the same time to stay motivated. With Pikoo you create a free room, share the link with classmates or friends, and everyone studies on the same Pomodoro timer, with session goals, focus music and a chat for breaks.",
    steps: [
      { name: "Create a study room", text: "Press Create Room on Pikoo. The default is 25 minutes of focus and 5 minutes of break." },
      { name: "Invite your study group", text: "Share the room link in your class group chat, Discord or WhatsApp." },
      { name: "Write what you'll study", text: "Add a goal like \"Chapter 4 problems\" so you and the room know what this session is for." },
      { name: "Study, then break together", text: "Start the timer, study until it ends, then use the break to chat or stretch." },
    ],
    sections: [
      {
        heading: "Why studying with others works",
        paragraphs: [
          "Studying next to other people, even online, raises the cost of getting distracted. You've told the room what you're working on, and you can see that everyone else is working too. That light social pressure is often enough to get started and keep going.",
          "Fixed sessions also help. A 25-minute block feels manageable, and a guaranteed break makes it easier to ignore your phone until then.",
        ],
      },
      {
        heading: "Good ways to use a study room",
        bullets: [
          "Exam prep with classmates: share goals, then quiz each other in the long break.",
          "Late-night solo study with a friend in another city.",
          "\"Study with me\" sessions for a community or Discord server.",
          "Silent library mode: mute the chat and play rain or brown noise.",
        ],
      },
    ],
    faqs: [
      { q: "How many people can join a study room?", a: "Rooms are designed for small groups such as a study group or a few friends, and anyone with the link can join." },
      { q: "Is there a camera or microphone?", a: "No. Pikoo has no video or audio calls. You share a timer, goals and a text chat, so you can study without being on camera." },
      { q: "Can I study alone?", a: "Yes. A room works fine as a personal Pomodoro timer with focus sounds and a to-do list." },
      { q: "Do rooms expire?", a: "A room stays available for 30 days after it was last used, so your study group can keep using the same link. You can also pick a custom link like /r/physics-group when creating it." },
    ],
    related: ["pomodoro-timer-with-friends", "pomodoro-technique", "body-doubling"],
    updated: UPDATED,
  },
  {
    slug: "body-doubling",
    label: "Body doubling online",
    title: "Body Doubling Online – Free Virtual Body Double Room",
    description:
      "Body doubling means working alongside someone to stay on task. Start a free online body doubling room with a shared timer and goals. Great for ADHD.",
    h1: "Online body doubling with a shared focus timer",
    answer:
      "Body doubling is working alongside another person, in person or online, so their presence helps you start and stay on a task. Many people with ADHD find it useful. Pikoo gives you a free body doubling room: share the link, set your goals, and work on one shared timer together.",
    steps: [
      { name: "Open a room", text: "Create a Pikoo room. Shorter sessions, such as 15 or 20 minutes, can make getting started easier." },
      { name: "Invite your body double", text: "Send the link to a friend, partner or accountability buddy." },
      { name: "Say what you'll do", text: "Each of you adds a goal and makes it public, so the other person can see it." },
      { name: "Work, then check in", text: "Work until the timer ends, then use the break to say how it went." },
    ],
    sections: [
      {
        heading: "Why body doubling helps",
        paragraphs: [
          "Starting is often the hardest part of a task. Having someone else present, even silently, makes the task feel less heavy and makes it easier to follow through on what you said you'd do.",
          "This is why body doubling is popular in ADHD communities, but it works for anyone who procrastinates, works alone at home, or struggles with boring admin.",
        ],
      },
      {
        heading: "Making online body doubling work",
        bullets: [
          "Keep the first session short. A 15-minute timer is easier to commit to than an hour.",
          "Make your goal concrete: \"Reply to three emails\" beats \"Do emails\".",
          "Use the break to check in, then start the next session straight away (or turn on auto-start).",
          "If silence feels awkward, play café or lo-fi sounds in the room.",
        ],
      },
    ],
    faqs: [
      { q: "Is body doubling good for ADHD?", a: "Many people with ADHD report that body doubling helps them start and finish tasks. It isn't a treatment, but it's a widely used practical strategy." },
      { q: "Do we have to be on video?", a: "No. Pikoo has no camera or microphone. Seeing the shared timer and each other's goals is often enough presence." },
      { q: "Can I body double with a stranger?", a: "Pikoo rooms are private to whoever has the link. Share links only with people you're comfortable working with." },
      { q: "How long should a body doubling session be?", a: "Anything from 15 to 50 minutes works. Start short and increase the length once getting started feels easier." },
    ],
    related: ["body-doubling-adhd", "virtual-coworking", "online-study-room"],
    updated: UPDATED,
  },
  {
    slug: "pomodoro-technique",
    label: "The Pomodoro Technique",
    title: "Pomodoro Technique: How It Works + Free Online Timer",
    description:
      "What the Pomodoro Technique is, how to do it step by step, the right session lengths, and a free online Pomodoro timer you can share with others.",
    h1: "The Pomodoro Technique, explained",
    answer:
      "The Pomodoro Technique is a time-management method where you work for 25 minutes, take a 5-minute break, and after four work sessions take a longer 15–30 minute break. Each 25-minute session is called a pomodoro. It was created by Francesco Cirillo in the late 1980s.",
    steps: [
      { name: "Pick one task", text: "Decide exactly what you'll work on during this session." },
      { name: "Set a 25-minute timer", text: "Start the timer and work only on that task until it rings." },
      { name: "Take a 5-minute break", text: "Stand up, stretch or get water. Avoid starting anything absorbing." },
      { name: "Repeat", text: "Start the next 25-minute session." },
      { name: "Take a long break after four", text: "After four sessions, rest for 15 to 30 minutes before starting again." },
    ],
    sections: [
      {
        heading: "Why the Pomodoro Technique works",
        paragraphs: [
          "A short, fixed block makes starting easier: 25 minutes feels doable even for a task you've been avoiding. Knowing a break is coming makes it easier to ignore distractions until then, and regular breaks help you keep your energy across a long day.",
        ],
      },
      {
        heading: "Choosing session lengths",
        bullets: [
          "Classic: 25 minutes of focus, 5 minutes of break, a 15-minute long break after 4 sessions.",
          "Deep work: 50 minutes of focus and 10 minutes of break, for tasks that take a while to warm up to.",
          "Getting started: 15 minutes of focus and 5 of break, useful when procrastinating or tired.",
          "In Pikoo you can set focus from 5 to 60 minutes, and add time mid-session if you don't want to stop.",
        ],
      },
      {
        heading: "Doing Pomodoros with other people",
        paragraphs: [
          "The technique works especially well in a group. With a shared timer everyone's breaks line up, so you can talk during them and keep each other accountable during the focus blocks. Pikoo is built for exactly that.",
        ],
      },
    ],
    faqs: [
      { q: "How long is a pomodoro?", a: "Traditionally 25 minutes of focused work, followed by a 5-minute break." },
      { q: "How long is the long break?", a: "Usually 15 to 30 minutes, taken after every four pomodoros." },
      { q: "Can I change the 25-minute length?", a: "Yes. Many people use 50/10 for deep work or 15/5 when starting is hard. Pick what lets you finish sessions without forcing it." },
      { q: "What do I do if I get interrupted?", a: "If it's short, note it down and return to the task. If it takes over, stop the pomodoro and start a fresh one afterwards." },
      { q: "Who invented the Pomodoro Technique?", a: "Francesco Cirillo, in the late 1980s. It's named after the tomato-shaped kitchen timer he used; pomodoro is Italian for tomato." },
    ],
    related: ["pomodoro-timer-with-friends", "online-study-room", "focus-timer-for-remote-teams"],
    updated: UPDATED,
  },
  {
    slug: "focus-timer-for-remote-teams",
    label: "Focus timer for remote teams",
    title: "Focus Timer for Remote Teams – Shared Pomodoro Sprints",
    description:
      "Run focus sprints with your remote team on one shared Pomodoro timer. Free, no sign-up, works in the browser. Set goals and take breaks together.",
    h1: "A shared focus timer for remote teams",
    answer:
      "A shared focus timer lets a remote team work in the same focus sprints and take breaks at the same time. With Pikoo you create a free room, drop the link in Slack or Teams, and everyone runs on one synced Pomodoro timer, with goals, chat and an optional host-only mode.",
    steps: [
      { name: "Create a team room", text: "Create a Pikoo room. Choose host mode if one person should run the timer." },
      { name: "Post the link", text: "Share the room link in your team channel or meeting invite." },
      { name: "Set sprint goals", text: "Everyone adds what they plan to finish in this sprint and makes it public." },
      { name: "Sprint and sync", text: "Work until the timer ends, then use the break for a quick check-in or to unblock someone." },
    ],
    sections: [
      {
        heading: "Why teams use focus sprints",
        paragraphs: [
          "Remote work is full of pings. A shared focus block gives the team an agreed window of no meetings and no messages, and a shared break gives a natural moment to ask questions without interrupting anyone mid-task.",
        ],
      },
      {
        heading: "Ideas for team focus sessions",
        bullets: [
          "A daily \"power hour\" of two 25-minute sprints right after stand-up.",
          "A deadline push: 50/10 sprints with goals visible to everyone.",
          "Pair work: two people on one timer, swapping driver at each break.",
          "Silent coworking for distributed teams across time zones.",
        ],
      },
    ],
    faqs: [
      { q: "Does Pikoo integrate with Slack or Teams?", a: "There's no integration to install. You share the room link in any channel and people join from their browser." },
      { q: "Can one person run the timer?", a: "Yes. Choose host mode when creating the room and only the host can start, pause, skip or add time." },
      { q: "Do teammates need accounts?", a: "No. Anyone with the link can join with a display name." },
      { q: "Is it secure for work?", a: "Rooms are only reachable by people with the link. Pikoo stores room state temporarily, and you shouldn't put confidential details in goals or chat." },
    ],
    related: ["virtual-coworking", "pomodoro-timer-with-friends", "pomodoro-technique"],
    updated: UPDATED,
  },
  {
    slug: "virtual-coworking",
    label: "Virtual coworking",
    title: "Virtual Coworking Room – Free, No Sign-Up",
    description:
      "Start a free virtual coworking room in seconds. Work alongside friends or colleagues on a shared Pomodoro timer with goals, focus sounds and chat.",
    h1: "A free virtual coworking room",
    answer:
      "Virtual coworking means working alongside other people online, each on your own tasks, to get the focus and company of an office. Pikoo gives you a free coworking room in one click: share the link, work on a shared Pomodoro timer, and chat during breaks. No sign-up, no camera.",
    steps: [
      { name: "Create a room", text: "Press Create Room on Pikoo." },
      { name: "Invite coworkers", text: "Send the link to friends, freelancers or colleagues." },
      { name: "Work in sessions", text: "Start the shared timer and each work on your own tasks." },
      { name: "Chat on breaks", text: "Use the break to catch up, then start the next session together." },
    ],
    sections: [
      {
        heading: "Why cowork virtually?",
        paragraphs: [
          "Working from home can be lonely and easy to drift through. Coworking online brings back some of the structure of an office: a shared start time, people around you who are also working, and someone to chat with on a break.",
        ],
      },
      {
        heading: "What makes Pikoo different",
        bullets: [
          "No video or microphone, so it's low-pressure and works on any connection.",
          "One shared timer, so everyone's breaks line up.",
          "Session goals you can share for accountability or keep private.",
          "Built-in focus sounds: lo-fi, rain, café, and white, brown or pink noise.",
        ],
      },
    ],
    faqs: [
      { q: "Is virtual coworking free on Pikoo?", a: "Yes, completely free with no account." },
      { q: "Do I need a webcam?", a: "No. Pikoo is a shared timer with goals and text chat, not a video call." },
      { q: "Can I cowork with people in other time zones?", a: "Yes. The timer is synced to the server clock, so everyone sees the same countdown wherever they are." },
      { q: "What should I work on?", a: "Anything. Everyone works on their own tasks; the room just keeps you on the same rhythm." },
    ],
    related: ["body-doubling", "focus-timer-for-remote-teams", "online-study-room"],
    updated: UPDATED,
  },
  {
    slug: "body-doubling-adhd",
    label: "Body doubling for ADHD",
    title: "Body Doubling for ADHD – Free, No Camera, No Sign-Up",
    description:
      "Free online body doubling for ADHD without a camera or a stranger on video. Join a silent focus room or invite one person to a shared timer.",
    h1: "Body doubling for ADHD, without a camera",
    answer:
      "Body doubling means doing a task while someone else is present, which many people with ADHD find makes it easier to start and keep going. You don't need a video call for it. On Pikoo you can join a silent public room where others are focusing on the same timer, or invite one person to a private room. It's free and needs no account.",
    steps: [
      { name: "Pick a room", text: "Join a silent public room at /library, or create a private room if you'd rather work with someone you know." },
      { name: "Name one small task", text: "Write down a first step small enough to start right now, like \"open the document and write one heading\"." },
      { name: "Start with the timer", text: "In a public room the timer is already running; just begin. In a private room, try a 15-minute session." },
      { name: "Use the break", text: "When the break comes, stand up, get water, then come back for the next round." },
    ],
    sections: [
      {
        heading: "Why skip the camera?",
        paragraphs: [
          "Video body doubling works for some people, but being watched can add pressure, and setting up a call is one more thing to do before you can start. Many people find that simply knowing others are working at the same moment is enough.",
          "Pikoo's public rooms show a live count of who's focusing and let you send a quick emoji, with no chat, names or camera. Private rooms add shared goals and text chat for when you want a little more accountability.",
        ],
      },
      {
        heading: "Tips that tend to help",
        bullets: [
          "Make the first task almost too small. Starting is usually the hardest part.",
          "Use the daily group sessions: same time each day, so you don't have to decide when to start.",
          "Put a timer you can see in front of you, not just on your phone.",
          "If silence is distracting, add brown noise, rain or lo-fi from the music button.",
          "Pair with one friend and make your goals public in the room, so you can both see them.",
        ],
      },
      {
        heading: "What body doubling isn't",
        paragraphs: [
          "It's a practical strategy, not a treatment. If ADHD is making daily life hard, talking to a qualified professional is worth doing alongside tools like this.",
        ],
      },
    ],
    faqs: [
      { q: "Is there free body doubling online?", a: "Yes. Pikoo is free with no account. You can join a public silent room or create a private room and share the link." },
      { q: "Can I body double without video?", a: "Yes. Pikoo has no camera or microphone. You see the shared timer and how many people are focusing, which is enough for many people." },
      { q: "Do I have to talk to strangers?", a: "No. Public rooms have no chat or names. You can send a quick emoji if you want to, but you don't have to." },
      { q: "How long should a session be?", a: "Short is fine. The Quick Sprints room uses 15-minute sessions, and private rooms can be set as short as 5 minutes." },
    ],
    related: ["body-doubling", "adhd-pomodoro-timer", "online-study-room"],
    updated: "2026-11-10",
  },
  {
    slug: "adhd-pomodoro-timer",
    label: "Pomodoro timer for ADHD",
    title: "Pomodoro Timer for ADHD – Shorter Sessions That Work",
    description:
      "How to adapt the Pomodoro Technique for ADHD: shorter focus blocks, visible timers and someone to work alongside. Free online timer, no sign-up.",
    h1: "A Pomodoro timer that works with ADHD",
    answer:
      "The classic Pomodoro is 25 minutes of focus and a 5-minute break. With ADHD, many people do better with shorter blocks, such as 10 to 15 minutes, a timer they can see, and someone else working at the same time. Pikoo lets you set any length, add time when you're in the flow, and focus alongside others for free.",
    steps: [
      { name: "Choose a short block", text: "Start with 15 minutes of focus and 5 minutes of break, or 10/5 if starting feels hard." },
      { name: "Write the first step", text: "Add one concrete goal to your task list so you know exactly what to do when the timer starts." },
      { name: "Start right away", text: "Press start before you feel ready. The timer is short, so the commitment is small." },
      { name: "Extend if you're in the flow", text: "If you're going well when time runs out, add 5 or 10 minutes instead of stopping." },
    ],
    sections: [
      {
        heading: "Why the standard 25 minutes can be too long",
        paragraphs: [
          "Twenty-five minutes can feel like a long time to hold attention on something boring, and that feeling alone can stop you from starting. A shorter block lowers the barrier. Once you're going, it's easy to add time.",
          "The opposite also happens: when you hit hyperfocus, a rigid timer can break it. Being able to add time without resetting helps here.",
        ],
      },
      {
        heading: "Adjustments worth trying",
        bullets: [
          "Shorter focus blocks (10–15 minutes) to make starting easier.",
          "A visible countdown on screen, not hidden in a phone.",
          "Breaks that involve moving, like standing up or getting water, not scrolling.",
          "A sound cue at the end of each block so you notice it.",
          "Someone else on the same timer, either a friend or a public silent room.",
        ],
      },
    ],
    faqs: [
      { q: "Is the Pomodoro Technique good for ADHD?", a: "Many people with ADHD find timed blocks helpful, especially when the blocks are shorter than the standard 25 minutes. It's worth experimenting to find a length that works for you." },
      { q: "What's the best Pomodoro length for ADHD?", a: "There's no single answer. Many people start with 10 or 15 minutes and lengthen it once starting feels easier." },
      { q: "Can I add time without restarting?", a: "Yes. In a Pikoo room you can add 5, 10 or any number of minutes to the current session." },
      { q: "Is this timer free?", a: "Yes. Pikoo is free, runs in the browser and needs no account." },
    ],
    related: ["body-doubling-adhd", "pomodoro-technique", "body-doubling"],
    updated: "2026-11-10",
  },
];

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);

// Homepage FAQ (also used for the homepage FAQPage markup)
export const HOME_FAQS: { q: string; a: string }[] = [
  { q: "What is Pikoo?", a: "Pikoo is a free, browser-based shared Pomodoro timer. You create a focus room, share its link, and everyone in the room sees the same synchronized timer, with session goals, focus sounds and chat." },
  { q: "Is Pikoo free?", a: "Yes. Pikoo is free, with no account, trial or download." },
  { q: "How do I share a Pomodoro timer with friends?", a: "Create a room on Pikoo, press Share Link, and send the link. Everyone who opens it joins the same live timer." },
  { q: "Do I need to sign up or install anything?", a: "No. Pikoo runs in any modern browser on desktop or mobile. You just pick a display name when you join." },
  { q: "Can I change the focus and break lengths?", a: "Yes. Focus can be 5–60 minutes, breaks 1–30 minutes and long breaks 5–45 minutes, with a long break after every 2–8 sessions. You can also add 5, 10 or any number of minutes mid-session." },
  { q: "Is there video or voice?", a: "No. Pikoo deliberately has no camera or microphone: just a shared timer, goals, focus sounds and a text chat." },
  { q: "Can only one person control the timer?", a: "Yes. Choose host mode when creating a room and only the host can start, pause, skip or add time. The default collaborative mode lets anyone control it." },
];
