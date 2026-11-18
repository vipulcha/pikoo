import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const LINKS = [
  { href: "/library", label: "Silent study rooms" },
  { href: "/", label: "Private rooms" },
  { href: "/obs", label: "Stream overlay" },
  { href: "/pomodoro-technique", label: "How Pomodoro works" },
];

// Short footer: the main places to go. Guide pages link to each other and are in the sitemap.
export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="relative z-10 border-t border-white/5 px-6 py-8">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-white/45 hover:text-white/80 transition-colors">{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-white/30">
          <span>{SITE_NAME}</span>
          {children}
        </div>
      </div>
    </footer>
  );
}
