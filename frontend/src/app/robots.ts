import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// AI answer engines that should be able to read and cite Pikoo
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Bingbot", "DuckAssistBot", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Rooms are private and short-lived, so keep them out of every index
      { userAgent: "*", allow: "/", disallow: "/r/" },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: "/r/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
