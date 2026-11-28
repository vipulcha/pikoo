"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MissingRoom } from "@/components/MissingRoom";

export function NotFoundView({ reserved }: { reserved: string[] }) {
  const pathname = usePathname() ?? "";
  const parts = pathname.split("/").filter(Boolean);
  let word: string | null = null;
  if (parts.length === 1) {
    try { word = decodeURIComponent(parts[0]).trim(); } catch { word = null; }
  }
  if (word && /^[\w -]{1,40}$/.test(word)) return <MissingRoom key={word} name={word} short reserved={reserved} />;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-white/60">There&apos;s nothing at this address.</p>
      <Link href="/" className="mt-7 inline-flex items-center h-12 px-8 rounded-full font-semibold bg-gradient-to-r from-rose-500 to-pink-500">
        Go to Pikoo
      </Link>
    </div>
  );
}
