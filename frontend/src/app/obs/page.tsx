import type { Metadata } from "next";
import Link from "next/link";
import { ObsBuilder } from "./ObsBuilder";
import { SiteFooter } from "@/components/SiteFooter";
import { absoluteUrl } from "@/lib/site";
import { faqNode, jsonLd } from "@/lib/structured-data";

const FAQS = [
  { q: "Is the OBS timer free?", a: "Yes. No sign-up, no watermark and no limit on streams or length." },
  { q: "Does it work with Streamlabs, YouTube and Twitch?", a: "Yes. It's a normal web page, so any streaming software with a browser source works, including OBS Studio and Streamlabs, on any platform." },
  { q: "Can viewers mess with my timer?", a: "No. The room is host-only: while you have your timer controls open, only you can start, pause, skip or add time. Viewers can join and follow along." },
  { q: "Can I use long sessions like 90/15 or 120/20?", a: "Yes. Focus blocks can be up to 2 hours and breaks up to an hour." },
  { q: "Will my overlay link keep working?", a: "Yes. Rooms last 30 days after they were last used, so if you stream regularly the same link keeps working." },
];

export const metadata: Metadata = {
  title: { absolute: "Free Pomodoro Timer Overlay for OBS – Study With Me Streams | Pikoo" },
  description:
    "A free Pomodoro timer overlay for OBS and Streamlabs with a transparent background. Your viewers can join the same timer. No sign-up, no watermark.",
  alternates: { canonical: absoluteUrl("/obs") },
};

export default function ObsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", ...faqNode(FAQS, absoluteUrl("/obs")) }) }} />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.12),transparent_65%)]" />
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:text-white/80">Pikoo</Link>
          <Link href="/library" className="text-sm text-white/60 hover:text-white">Silent study rooms</Link>
        </div>
      </header>
      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-300">For study-with-me streamers</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">A Pomodoro timer overlay your viewers can join</h1>
        <p data-answer className="mt-5 text-lg text-white/75 leading-relaxed">
          Add a clean, transparent Pomodoro timer to OBS in under a minute. Unlike other overlays, it&apos;s also a live
          room: drop the link in chat and your viewers focus on the exact same countdown. Free, no sign-up, no watermark.
        </p>
        <div className="mt-10">
          <ObsBuilder />
        </div>
        <section className="mt-16">
          <h2 className="text-2xl font-semibold">Questions</h2>
          <dl className="mt-6 space-y-5">
            {FAQS.map((f) => (
              <div key={f.q}>
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1 text-sm text-white/60 leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
