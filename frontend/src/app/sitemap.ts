import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
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
    { url: absoluteUrl("/llms.txt"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];
}
