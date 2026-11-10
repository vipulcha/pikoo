import Link from "next/link";
import { GUIDES } from "@/lib/guides";
import { SITE_NAME } from "@/lib/site";

// Footer with links to every guide page, so each one is reachable from every page
export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="relative z-10 border-t border-white/5 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <nav aria-label="Guides" className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <Link href="/library" className="text-white/45 hover:text-white/80 transition-colors">Live silent study rooms</Link>
          <Link href="/timer/25-minutes" className="text-white/45 hover:text-white/80 transition-colors">25 minute timer</Link>
          <Link href="/timer/50-10" className="text-white/45 hover:text-white/80 transition-colors">50/10 Pomodoro timer</Link>
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/${g.slug}`} className="text-white/45 hover:text-white/80 transition-colors">
              {g.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <span>{SITE_NAME} · Free shared Pomodoro timer</span>
          {children}
        </div>
      </div>
    </footer>
  );
}
