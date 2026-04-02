import { CreateRoomPanel, CreateRoomButton } from "@/components/CreateRoomPanel";

const STARS = [...Array(50)].map((_, i) => ({
  id: i,
  width: 1 + (i % 3),
  left: (i * 17) % 100,
  top: (i * 23) % 100,
  opacity: 0.3 + ((i % 7) / 10),
  delay: (i % 4),
  duration: 2 + (i % 3),
}));

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

        {/* Solar system */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo / Title */}
        <div className="text-center mb-16 relative">
          <h1 className="relative text-5xl sm:text-7xl font-bold tracking-tight mb-6 opacity-0 animate-slide-up drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            <span className="text-white">Focus together. </span>
            <span className="animate-shimmer">Instantly.</span>
          </h1>
          <p className="relative text-white/80 text-lg sm:text-xl max-w-lg mx-auto opacity-0 animate-slide-up animation-delay-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            Shared Pomodoro rooms with session goals, lo-fi music, and real-time presence. Built for studying, body doubling, and remote work.
          </p>
        </div>

        {/* Three-column hero row */}
        <div className="w-full max-w-6xl px-8 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-16 lg:gap-16 opacity-0 animate-slide-up animation-delay-400">

          {/* Built for — left */}
          <div className="hidden lg:block text-right">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-6">Built for</p>
            <ul className="space-y-4">
              {[
                "Study sessions",
                "Body doubling / accountability",
                "Remote work sprints",
                "Coworking with a friend",
              ].map((item) => (
                <li key={item} className="text-white/55 text-sm font-medium">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Centre — CTA (client component) */}
          <CreateRoomPanel />

          {/* How it works — right */}
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-6">How it works</p>
            <ol className="space-y-5">
              {["Create a room", "Share the link", "Focus together"].map((step, i) => (
                <li key={step} className="flex items-center gap-4">
                  <span className="font-mono text-rose-400/70 tabular-nums text-xs shrink-0">0{i + 1}</span>
                  <span className="text-white/75 text-base font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </div>

        </div>{/* end three-col grid */}

        {/* Mobile-only: Built for + How it works */}
        <div className="lg:hidden w-full max-w-md mx-auto mt-16 grid grid-cols-2 gap-8 text-center opacity-0 animate-slide-up animation-delay-400">
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Built for</p>
            <ul className="space-y-2">
              {["Study sessions", "Body doubling", "Remote sprints", "Coworking"].map((item) => (
                <li key={item} className="text-white/55 text-sm font-medium">{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">How it works</p>
            <ol className="space-y-2">
              {["Create a room", "Share the link", "Focus together"].map((step, i) => (
                <li key={step} className="flex items-center justify-center gap-2">
                  <span className="font-mono text-rose-400/70 tabular-nums text-xs">0{i + 1}</span>
                  <span className="text-white/75 text-sm font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

      </div>

      {/* Below-the-fold sections */}
      <div className="relative z-10 border-t border-white/5">

        {/* Why Pikoo */}
        <section className="py-20 sm:py-28 px-6">
          <div className="max-w-xl mx-auto">
            <h2 className="text-lg sm:text-xl font-semibold text-white/50 uppercase tracking-widest mb-10">
              Why Pikoo
            </h2>
            <ul className="space-y-6">
              {[
                ["Start in seconds", "no accounts, no setup"],
                ["Work better together", "simple shared focus sessions"],
                ["No meeting overhead", "just a room and a timer"],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-4 text-lg sm:text-xl">
                  <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span>
                    <span className="text-white font-semibold">{title}</span>
                    <span className="text-white/50"> — {desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto max-w-xl px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Social proof */}
        <section className="py-20 sm:py-28 px-6">
          <div className="max-w-xl mx-auto flex flex-col items-center gap-4 text-center">
            {[
              "Used for 300+ focus sessions",
              "Loved by students and remote teams",
            ].map((quote) => (
              <p
                key={quote}
                className="text-white/40 text-base sm:text-lg italic"
              >
                &ldquo;{quote}&rdquo;
              </p>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pb-28 px-6">
          <div className="max-w-md mx-auto text-center">
            <CreateRoomButton />
          </div>
        </section>
      </div>
    </div>
  );
}
