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
      // Rooms and embeds are crawlable so chat apps can build link previews; they
      // stay out of search indexes via noindex (meta tag + X-Robots-Tag header)
      { userAgent: "*", allow: "/" },
      { userAgent: AI_CRAWLERS, allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
