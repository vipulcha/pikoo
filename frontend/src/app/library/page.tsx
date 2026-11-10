import type { Metadata } from "next";
import Link from "next/link";
import { LibraryList } from "@/components/LibraryList";
import { SiteFooter } from "@/components/SiteFooter";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Live Online Study Rooms – Silent, Free, No Sign-Up | Pikoo" },
  description:
    "Drop into a live silent study room and focus alongside other people. Shared Pomodoro timer on a fixed schedule, no chat, no camera, no sign-up.",
  alternates: { canonical: absoluteUrl("/library") },
};

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.12),transparent_65%)]" />
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:text-white/80">Pikoo</Link>
          <Link href="/" className="text-sm text-white/60 hover:text-white">Create a private room</Link>
        </div>
      </header>
      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-20">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">Live silent study rooms</h1>
        <p data-answer className="text-lg text-white/75 leading-relaxed max-w-2xl">
          Public rooms where anyone can focus alongside other people. The timer runs on a fixed schedule, so sessions
          start on the hour for everyone. There&apos;s no chat, no camera and no names, just a live count of who&apos;s
          focusing with you.
        </p>
        <div className="mt-10">
          <LibraryList />
        </div>
        <section className="mt-16 grid gap-8 sm:grid-cols-2 text-sm text-white/60 leading-relaxed">
          <div>
            <h2 className="text-white font-semibold mb-2">How it works</h2>
            <p>Pick a room and press play on a focus sound if you like. The countdown is the same for everyone, and breaks line up automatically. Send a 👋 or 🔥 to say hi without breaking the silence.</p>
          </div>
          <div>
            <h2 className="text-white font-semibold mb-2">Want to talk or set your own timer?</h2>
            <p>Create a <Link href="/" className="text-rose-300 hover:text-rose-200">private room</Link> and share the link with friends. Private rooms have chat, shared goals and full timer control.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
