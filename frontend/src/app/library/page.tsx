import type { Metadata } from "next";
import Link from "next/link";
import { LibraryList, SharedClock } from "@/components/LibraryList";
import { DailySessions } from "@/components/DailySessions";
import { CampaignRedirect } from "@/components/CampaignRedirect";
import { SiteFooter } from "@/components/SiteFooter";
import { absoluteUrl } from "@/lib/site";
import { newsreader } from "@/lib/fonts";
import { librarySnapshot } from "@/lib/libraryCounts";
import { DevLiveBadge } from "@/components/DevRoomBits";

// Rendered per request: the HTML states the current phase, minutes left and real
// headcounts, which a cached copy would get wrong
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Live Online Study Rooms – Silent, Free, No Sign-Up | Pikoo" },
  description:
    "Public silent study rooms where the Pomodoro timer runs on a fixed schedule for everyone. No chat, no names, no camera, no sign-up. Exam rooms count down to JEE, NEET, SAT, AP, A-levels and more.",
  alternates: { canonical: absoluteUrl("/library") },
};

export default async function LibraryPage() {
  const { now, counts } = await librarySnapshot();
  return (
    <div className={`${newsreader.variable} min-h-screen bg-stone-950 text-stone-200`}>
      <CampaignRedirect counts={counts} />
      <header className="border-b border-stone-800">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-stone-100 hover:text-white">Pikoo</Link>
          <Link href="/" className="text-sm text-stone-400 hover:text-stone-100">Make a private room →</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 sm:px-6 pt-14 sm:pt-20 pb-20">
        <p className="text-sm text-stone-500">Pikoo library</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl text-stone-50 leading-tight tracking-tight">Silent study rooms</h1>
        <div className="mt-8">
          <SharedClock initialNow={now} />
        </div>
        <p data-answer className="mt-8 text-lg text-stone-300 leading-relaxed max-w-2xl">
          Every room runs one timer for everyone, starting on the hour, so nobody has to organise anything. Walk in, see
          how long is left, and start working. No chat, no names, no camera.
        </p>
        <div className="mt-6 empty:hidden">
          <DevLiveBadge from="library" />
        </div>

        <section aria-labelledby="rooms" className="mt-14">
          <h2 id="rooms" className="font-serif text-2xl text-stone-100">Rooms</h2>
          <div className="mt-5">
            <LibraryList initialNow={now} initialCounts={counts} />
          </div>
        </section>

        <section id="exams" aria-labelledby="exams-title" className="mt-16 scroll-mt-6">
          <h2 id="exams-title" className="font-serif text-2xl text-stone-100">Exam rooms</h2>
          <p className="mt-2 text-stone-400">The same 50/10 clock, with a countdown to exam day.</p>
          <h3 className="mt-8 mb-2 text-xs font-medium uppercase tracking-[0.15em] text-stone-500">India</h3>
          <LibraryList exams="india" initialNow={now} initialCounts={counts} />
          <h3 className="mt-10 mb-2 text-xs font-medium uppercase tracking-[0.15em] text-stone-500">International</h3>
          <LibraryList exams="international" initialNow={now} initialCounts={counts} />
        </section>

        <div className="mt-16">
          <DailySessions initialNow={now} />
        </div>

        <section className="mt-16 grid gap-10 sm:grid-cols-2 text-stone-400 leading-relaxed">
          <div>
            <h2 className="font-serif text-xl text-stone-100 mb-2">How it works</h2>
            <p>The countdown never pauses, so if you arrive mid-block you just join in. Breaks line up for everyone. Tap 👋 or 🔥 to say hi without breaking the silence.</p>
          </div>
          <div>
            <h2 className="font-serif text-xl text-stone-100 mb-2">Want to talk, or set your own timer?</h2>
            <p>Make a <Link href="/" className="text-stone-100 underline decoration-stone-600 underline-offset-4 hover:decoration-stone-300">private room</Link> and share the link. Private rooms have chat, shared goals and full timer control.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
