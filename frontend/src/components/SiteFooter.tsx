import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

// The timer links keep the /timer pages reachable (each one links all the others);
// the guides are linked from the homepage and from each other.
const LINKS = [
  { href: "/library", label: "Silent study rooms" },
  { href: "/", label: "Private rooms" },
  { href: "/timer/25-minutes", label: "25 min timer" },
  { href: "/timer/50-10", label: "50/10 timer" },
  { href: "/obs", label: "Stream overlay" },
  { href: "/pomodoro-technique", label: "How Pomodoro works" },
];

// Short footer: the main places to go
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
