import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { TIMER_PRESETS, getTimerPreset } from "@/lib/timers";
import { absoluteUrl } from "@/lib/site";
import { jsonLd } from "@/lib/structured-data";
import { SoloTimer } from "./SoloTimer";

export const dynamicParams = false;
export const generateStaticParams = () => TIMER_PRESETS.map((t) => ({ preset: t.slug }));

type Props = { params: Promise<{ preset: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTimerPreset((await params).preset);
  if (!t) return {};
  const title = `${t.label} – Free Online${t.breakMin ? "" : " Countdown"}, Shareable | Pikoo`;
  const description = `${t.intro.split(". ")[0]}. Starts instantly in your browser, no sign-up, and you can share it with friends.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl(`/timer/${t.slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/timer/${t.slug}`) },
  };
}

export default async function TimerPage({ params }: Props) {
  const t = getTimerPreset((await params).preset);
  if (!t) notFound();

  const faqs = [
    { q: `How do I use the ${t.label.toLowerCase()}?`, a: `Press Start (or the space bar). ${t.breakMin ? `It counts down ${t.focusMin} minutes of focus, plays a sound, then runs a ${t.breakMin}-minute break and repeats.` : `It counts down ${t.focusMin} minutes and plays a sound when time is up.`} Keep the tab open; the countdown stays accurate in the background.` },
    { q: "Can I share this timer with friends?", a: "Yes. Press \"Make it shared\" to turn it into a room with the same lengths, then send the link. Everyone sees the same countdown in real time." },
    { q: "Is it free?", a: "Yes, free with no account or download." },
  ];

  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        url: absoluteUrl(`/timer/${t.slug}`),
        name: t.label,
        description: t.intro,
        isPartOf: { "@id": `${absoluteUrl("/")}/#website` },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  const others = TIMER_PRESETS.filter((o) => o.slug !== t.slug);

  return (
    <div className="min-h-screen bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:text-white/80">Pikoo</Link>
          <Link href="/library" className="text-sm text-white/60 hover:text-white">Focus with others →</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6">
        <section className="pt-14 pb-16">
          <SoloTimer focusMin={t.focusMin} breakMin={t.breakMin} />
        </section>

        <article className="max-w-2xl mx-auto pb-20">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t.label}</h1>
          <p data-answer className="text-lg text-white/75 leading-relaxed">{t.intro}</p>

          <h2 className="mt-10 text-xl font-semibold mb-3">Good for</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70 marker:text-rose-400/70">
            {t.uses.map((u) => <li key={u}>{u}</li>)}
          </ul>

          <h2 className="mt-10 text-xl font-semibold mb-3">FAQ</h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {faqs.map((f) => (
              <div key={f.q} className="py-4">
                <h3 className="font-medium mb-1">{f.q}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-xl font-semibold mb-3">Other timers</h2>
          <div className="flex flex-wrap gap-2">
            {others.map((o) => (
              <Link key={o.slug} href={`/timer/${o.slug}`} className="px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30 text-sm text-white/70 hover:text-white">
                {o.label}
              </Link>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
