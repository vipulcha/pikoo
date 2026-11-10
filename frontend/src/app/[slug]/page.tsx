import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateRoomButton } from "@/components/CreateRoomPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { GUIDES, getGuide } from "@/lib/guides";
import { SITE_NAME, absoluteUrl } from "@/lib/site";
import { guideGraph, jsonLd } from "@/lib/structured-data";

// Only the slugs in GUIDES exist; anything else is a 404
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const url = absoluteUrl(`/${guide.slug}`);
  return {
    title: { absolute: guide.title },
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: SITE_NAME,
      title: guide.title,
      description: guide.description,
      modifiedTime: guide.updated,
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const related = guide.related.map(getGuide).filter((g) => g !== undefined);

  return (
    <div className="min-h-screen bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(guideGraph(guide)) }} />

      <div className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.12),transparent_65%)]" />

      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:text-white/80">
            {SITE_NAME}
          </Link>
          <Link
            href="/"
            className="text-sm px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-400 transition-colors font-medium"
          >
            Start a room
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-20">
        <nav aria-label="Breadcrumb" className="text-sm text-white/40 mb-8">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:text-white/70">{SITE_NAME}</Link></li>
            <li aria-hidden>/</li>
            <li className="text-white/60 truncate">{guide.label}</li>
          </ol>
        </nav>

        <article>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-6">{guide.h1}</h1>

          {/* Direct answer, first thing on the page: what search snippets and AI assistants quote */}
          <p data-answer className="text-lg sm:text-xl text-white/80 leading-relaxed">
            {guide.answer}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="sm:w-64"><CreateRoomButton /></div>
            <p className="text-sm text-white/40">Free · No sign-up · Works in your browser</p>
          </div>

          {guide.steps && (
            <section className="mt-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">How to do it</h2>
              <ol className="space-y-4">
                {guide.steps.map((step, i) => (
                  <li key={step.name} id={`step-${i + 1}`} className="flex gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <span className="font-mono text-rose-400/80 tabular-nums text-sm pt-0.5">0{i + 1}</span>
                    <div>
                      <h3 className="font-semibold mb-1">{step.name}</h3>
                      <p className="text-white/60 leading-relaxed">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {guide.sections.map((section) => (
            <section key={section.heading} className="mt-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-5">{section.heading}</h2>
              {section.paragraphs?.map((p) => (
                <p key={p} className="text-white/70 leading-relaxed mb-4">{p}</p>
              ))}
              {section.bullets && (
                <ul className="space-y-2.5 list-disc pl-5 marker:text-rose-400/70 text-white/70 leading-relaxed">
                  {section.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}

          <section className="mt-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Frequently asked questions</h2>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {guide.faqs.map((f) => (
                <div key={f.q} className="py-5">
                  <h3 className="font-semibold mb-2">{f.q}</h3>
                  <p className="text-white/65 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 p-8 rounded-3xl bg-gradient-to-br from-rose-500/15 to-transparent border border-rose-500/20 text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Ready to focus?</h2>
            <p className="text-white/60 mb-6">Create a room and share the link. It takes about five seconds.</p>
            <div className="max-w-xs mx-auto"><CreateRoomButton /></div>
          </section>

          <p className="mt-10 text-xs text-white/30">
            Last updated <time dateTime={guide.updated}>{new Date(guide.updated).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
          </p>
        </article>

        {related.length > 0 && (
          <aside className="mt-16">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">Related</h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/${r.slug}`} className="block h-full p-4 rounded-xl border border-white/10 hover:border-white/25 bg-white/[0.02] transition-colors">
                    <span className="text-sm font-medium text-white/85">{r.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
