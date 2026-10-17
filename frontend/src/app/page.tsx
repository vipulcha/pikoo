import { CreateRoomPanel, CreateRoomButton } from "@/components/CreateRoomPanel";
import { LiveCount } from "@/components/LiveCount";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { SuggestionButton } from "@/components/SuggestionButton";

const STARS = [...Array(50)].map((_, i) => ({
  id: i,
  width: 1 + (i % 3),
  left: (i * 17) % 100,
  top: (i * 23) % 100,
  opacity: 0.3 + ((i % 7) / 10),
  delay: (i % 4),
  duration: 2 + (i % 3),
}));

const FEATURES = [
  {
    title: "One timer, everyone in sync",
    desc: "Start, pause or skip and the whole room sees it instantly. Breaks and focus can roll on automatically.",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Session goals",
    desc: "Write down what you're working on. Share it with the room for accountability, or keep it private.",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Focus sounds",
    desc: "Lo-fi, rain, café ambience and white, brown or pink noise, built right in.",
    icon: "M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z",
  },
  {
    title: "Room chat",
    desc: "Say hi, check in during breaks, and keep each other going.",
    icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z",
  },
];

const BUILT_FOR = ["Study sessions", "Body doubling", "Remote work sprints", "Coworking with a friend"];
const STEPS = ["Create a room", "Share the link", "Focus together"];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Pikoo",
    url: "https://pikoo.live",
    description:
      "Shared Pomodoro rooms with session goals, lo-fi music, and real-time presence. Built for studying, body doubling, and remote work.",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        {/* Headline */}
        <div className="text-center mb-12 sm:mb-14 relative">
          {/* Soft dark halo so stars and planets behind the text don't hurt readability */}
          <div className="absolute -inset-x-16 -inset-y-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.5)_45%,transparent_75%)] pointer-events-none" />
          <h1 className="relative text-5xl sm:text-7xl font-bold tracking-tight mb-6 opacity-0 animate-slide-up drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            <span className="text-white">Focus together. </span>
            <span className="animate-shimmer">Instantly.</span>
          </h1>
          <p className="relative text-white/80 text-lg sm:text-xl max-w-lg mx-auto opacity-0 animate-slide-up animation-delay-200">
            Shared Pomodoro rooms with session goals, lo-fi music, and real-time presence. Built for studying, body doubling, and remote work.
          </p>
          <LiveCount />
        </div>

        {/* Three-column hero row */}
        <div className="w-full max-w-6xl px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-12 lg:gap-16 opacity-0 animate-slide-up animation-delay-400">

          {/* Built for (left) */}
          <div className="hidden lg:block text-right">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">Built for</p>
            <ul className="space-y-3.5">
              {BUILT_FOR.map((item) => (
                <li key={item} className="text-white/70 text-[15px] font-medium">{item}</li>
              ))}
            </ul>
          </div>

          {/* Centre: create, or join an existing room */}
          <div className="w-full max-w-md mx-auto">
            <CreateRoomPanel />
            <div className="mt-8 flex items-center gap-3 text-xs text-white/35 uppercase tracking-widest">
              <span className="h-px flex-1 bg-white/10" />
              or join a room
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="mt-4">
              <JoinRoomForm />
            </div>
          </div>

          {/* How it works (right) */}
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">How it works</p>
            <ol className="space-y-3.5">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-white/70 text-[15px] font-medium">
                  <span className="font-mono text-rose-400/80 tabular-nums text-xs">0{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Scroll hint */}
        <a
          href="#features"
          className="mt-14 hidden sm:flex flex-col items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors opacity-0 animate-slide-up animation-delay-400"
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
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-3">
              Everything you need to focus together
            </h2>
            <p className="text-white/50 text-center mb-12 sm:mb-14">
              No accounts, no setup, no meeting overhead. Just a room and a timer.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="w-10 h-10 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                    <svg className="w-5 h-5 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>

            {/* Mobile-only: Built for + How it works */}
            <div className="lg:hidden mt-14 grid grid-cols-1 min-[420px]:grid-cols-2 gap-10">
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

        {/* Social proof + bottom CTA */}
        <section className="py-20 sm:py-28 px-6">
          <div className="max-w-md mx-auto text-center">
            <p className="text-5xl sm:text-6xl font-bold tracking-tight">300+</p>
            <p className="mt-2 text-white/60">focus sessions hosted, by students and remote teams</p>
            <p className="mt-12 mb-6 text-xl font-semibold">Ready to focus?</p>
            <CreateRoomButton />
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 px-6 py-8">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
            <span>Pikoo · Free shared Pomodoro timer</span>
            <SuggestionButton />
          </div>
        </footer>
      </div>
    </div>
  );
}
