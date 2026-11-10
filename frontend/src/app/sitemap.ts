import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { LIBRARY_ROOMS } from "@/lib/library";
import { TIMER_PRESETS } from "@/lib/timers";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    ...GUIDES.map((g) => ({
      url: absoluteUrl(`/${g.slug}`),
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/library"), lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    ...LIBRARY_ROOMS.map((r) => ({ url: absoluteUrl(`/library/${r.id}`), lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.7 })),
    ...TIMER_PRESETS.map((t) => ({ url: absoluteUrl(`/timer/${t.slug}`), lastModified: new Date("2026-11-10"), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: absoluteUrl("/llms.txt"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];
}
