import Link from "next/link";
import { CreateRoomPanel, CreateRoomButton } from "@/components/CreateRoomPanel";
import { GlobalStats } from "@/components/GlobalStats";
import { LibraryList } from "@/components/LibraryList";
import { NextSessionLine } from "@/components/DailySessions";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { SuggestionButton } from "@/components/SuggestionButton";
import { SiteFooter } from "@/components/SiteFooter";
import { HOME_FAQS } from "@/lib/guides";
import { SITE_SUMMARY } from "@/lib/site";
import { homeGraph, jsonLd } from "@/lib/structured-data";

const STARS = [...Array(50)].map((_, i) => ({
  id: i,
  width: 1 + (i % 3),
  left: (i * 17) % 100,
  top: (i * 23) % 100,
  opacity: 0.3 + ((i % 7) / 10),
  delay: (i % 4),
  duration: 2 + (i % 3),
}));

const FEATURES: { title: string; desc: string; icon: string; href?: string }[] = [
  {
    title: "One timer, everyone in sync",
    desc: "Start, pause or skip and the whole room sees it instantly. Breaks and focus can roll on automatically.",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Goals and chat",
    desc: "Share what you're working on for accountability, or keep it private. Chat and check in during breaks.",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Focus sounds",
    desc: "Lo-fi, rain, café ambience and white, brown or pink noise, built right in.",
    icon: "M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z",
  },
  {
    title: "Silent public rooms",
    desc: "Drop in and focus with strangers on a fixed schedule, plus daily group sessions. No chat, nothing to moderate.",
    icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
    href: "/library",
  },
  {
    title: "Schedules & leaderboard",
    desc: "Set a regular session your group can add to their calendar, and see who focused most this week.",
    icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  },
  {
    title: "Stream & Notion timer",
    desc: "A transparent overlay for OBS study-with-me streams that viewers can join, or embed it in Notion.",
    icon: "M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z",
    href: "/obs",
  },
];


const BUILT_FOR = ["Study sessions", "Body doubling", "Remote work sprints", "Coworking with a friend"];
const STEPS = ["Create a room", "Share the link", "Focus together"];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homeGraph(HOME_FAQS)) }}
      />

      {/* Space background with stars */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Subtle space gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950/50 to-black" />
        
        {/* Star field */}
        <div className="absolute inset-0">
          {STARS.map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white animate-twinkle"
              style={{
                width: `${star.width}px`,
                height: `${star.width}px`,
                left: `${star.left}%`,
                top: `${star.top}%`,
                opacity: star.opacity,
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
              }}
            />
          ))}
        </div>

        {/* Solar system (dimmed so planets passing behind the headline don't compete with it) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60">
          {/* Sun glow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-amber-500/80 rounded-full blur-md animate-sun-pulse" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-amber-500/30 rounded-full blur-xl" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
          
          {/* Orbit 1 - Mercury */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-1">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-400 rounded-full shadow-lg shadow-gray-400/50" />
            </div>
          </div>
          
          {/* Orbit 2 - Venus */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-2">
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-200 rounded-full shadow-lg shadow-amber-200/50" />
            </div>
          </div>
          
          {/* Orbit 3 - Earth */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-3">
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-full shadow-lg shadow-blue-400/50" />
            </div>
          </div>
          
          {/* Orbit 4 - Mars */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-4">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-rose-500 rounded-full shadow-lg shadow-rose-500/50" />
            </div>
          </div>
          
          {/* Orbit 5 - Jupiter */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-gradient-to-br from-amber-600 to-orange-300 rounded-full shadow-lg shadow-amber-500/30" />
            </div>
          </div>
          
          {/* Orbit 6 - Saturn with ring */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] border border-white/5 rounded-full">
            <div className="absolute w-full h-full animate-orbit-6">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <div className="relative w-5 h-5 bg-gradient-to-br from-amber-200 to-amber-400 rounded-full shadow-lg shadow-amber-300/30" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-2 border border-amber-300/50 rounded-full -rotate-12" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Ambient glow from sun */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent rounded-full" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
        {/* Headline */}
        <div className="text-center mb-8 relative">
          {/* Soft dark halo so stars and planets behind the text don't hurt readability */}
          <div className="absolute -inset-x-16 -inset-y-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.5)_45%,transparent_75%)] pointer-events-none" />
          <h1 className="relative text-5xl sm:text-7xl font-bold tracking-tight mb-5 opacity-0 animate-slide-up drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            <span className="block mb-4 text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-rose-300/80 drop-shadow-none">
              Free shared Pomodoro timer
            </span>
            <span className="text-white">Focus together. </span>
            <span className="animate-shimmer">Instantly.</span>
          </h1>
          <p className="relative text-white/80 text-lg sm:text-xl max-w-xl mx-auto opacity-0 animate-slide-up animation-delay-200">
            Start a private room with friends, or slip into a silent room with people studying right now. Free, no sign-up.
          </p>
          <a href="#silent-rooms" className="relative lg:hidden mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-sm text-emerald-200 opacity-0 animate-slide-up animation-delay-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Jump into a silent room ↓
          </a>
        </div>

        {/* Two ways in: your own room, or the public silent library */}
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-5 opacity-0 animate-slide-up animation-delay-400">

          <section aria-labelledby="private-room-title" className="flex flex-col rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/90">Private room</p>
            <h2 id="private-room-title" className="mt-2 text-2xl font-semibold tracking-tight">Focus with your people</h2>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              Your own timer, shared by link. Everyone stays in sync, with goals, chat and music. Great for friends, study groups and teams.
            </p>
            <div className="mt-6">
              <CreateRoomPanel />
            </div>
            <ol className="mt-6 hidden sm:grid grid-cols-3 gap-2 text-center">
              {STEPS.map((step, i) => (
                <li key={step} className="rounded-xl bg-white/[0.03] border border-white/5 px-2 py-2.5">
                  <span className="block font-mono text-[11px] text-rose-400/80">0{i + 1}</span>
                  <span className="block mt-0.5 text-xs text-white/65">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-auto pt-6">
              <p className="mb-2 text-xs text-white/40">Got a link from a friend?</p>
              <JoinRoomForm />
            </div>
          </section>

          <section id="silent-rooms" aria-labelledby="silent-rooms-title" className="scroll-mt-6 relative flex flex-col rounded-3xl border border-emerald-400/25 bg-black/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_60px_-20px_rgba(16,185,129,0.35)]">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
              Silent library
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] tracking-wider text-emerald-200">New</span>
            </p>
            <h2 id="silent-rooms-title" className="mt-2 text-2xl font-semibold tracking-tight">Focus with strangers</h2>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              Public rooms on a fixed Pomodoro clock. No chat, no camera, no names. Just you and everyone else, working quietly together.
            </p>
            <div className="mt-6">
              <LibraryList rows />
            </div>
            <Link href="/library#exams" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-2.5 text-sm text-amber-100 hover:bg-amber-300/[0.12] transition-colors">
              <span>Studying for an exam? <span className="text-amber-200/70">JEE, NEET, UPSC, SAT, AP, A-levels, IB and more</span></span>
              <span aria-hidden>→</span>
            </Link>
            <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <NextSessionLine />
              <Link href="/library" className="text-white/50 hover:text-white transition-colors">How it works →</Link>
            </div>
          </section>
        </div>

        {/* Scroll hint */}
        <a
          href="#features"
          className="mt-10 hidden sm:flex flex-col items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors opacity-0 animate-slide-up animation-delay-400"
        >
          What&apos;s inside
          <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </a>
      </div>

      {/* Below-the-fold sections */}
      <div className="relative z-10 border-t border-white/5 bg-black/60 backdrop-blur-sm">

        {/* Features */}
        <section id="features" className="py-20 sm:py-28 px-6 scroll-mt-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-3">
              Everything you need to focus together
            </h2>
            <p className="text-white/50 text-center mb-12 sm:mb-14">
              No accounts, no setup, no meeting overhead. Just a room and a timer.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="relative p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-white/[0.015] border border-white/10 hover:border-rose-400/30 transition-colors"
                >
                  <div className="w-10 h-10 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                    <svg className="w-5 h-5 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{feature.desc}</p>
                  {feature.href && (
                    <Link href={feature.href} className="mt-3 inline-block text-sm text-rose-300 hover:text-rose-200 after:absolute after:inset-0">
                      Try it →
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Built for + How it works */}
            <div className="mt-14 mx-auto max-w-2xl grid grid-cols-1 min-[420px]:grid-cols-2 gap-10">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">Built for</p>
                <ul className="space-y-2">
                  {BUILT_FOR.map((item) => (
                    <li key={item} className="text-white/70 text-sm font-medium">{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">How it works</p>
                <ol className="space-y-2">
                  {STEPS.map((step, i) => (
                    <li key={step} className="flex items-center gap-2 text-white/70 text-sm font-medium">
                      <span className="font-mono text-rose-400/80 tabular-nums text-xs">0{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-xl px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* What is Pikoo: a short, self-contained answer for search snippets and AI assistants */}
        <div className="max-w-5xl mx-auto px-6 py-20 sm:py-28 grid gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16">
        <section id="what-is-pikoo">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-5">What is Pikoo?</h2>
            <p data-answer className="text-lg text-white/70 leading-relaxed">{SITE_SUMMARY}</p>
          </div>
        </section>

        {/* FAQ (mirrored in the FAQPage structured data) */}
        <section id="faq">
          <div>
            <h2 className="text-xl font-semibold tracking-tight mb-4 text-white/85">Questions</h2>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {HOME_FAQS.filter((f) => f.q !== "What is Pikoo?").map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-white/85 hover:text-white [&::-webkit-details-marker]:hidden">
                    <h3>{f.q}</h3>
                    <span className="text-white/40 transition-transform group-open:rotate-45 text-xl leading-none" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 text-white/65 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        </div>

        <div className="mx-auto max-w-xl px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Social proof + bottom CTA */}
        <section className="py-20 sm:py-28 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <GlobalStats />
            <p className="mt-6 text-sm text-white/40">by students, study groups and remote teams</p>
            <p className="mt-12 mb-6 text-xl font-semibold">Ready to focus?</p>
            <CreateRoomButton />
          </div>
        </section>

        <SiteFooter>
          <SuggestionButton />
        </SiteFooter>
      </div>
    </div>
  );
}
