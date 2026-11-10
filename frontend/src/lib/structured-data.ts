import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_SUMMARY, FEATURE_LIST, absoluteUrl } from "./site";
import type { Guide } from "./guides";

// schema.org JSON-LD builders. IDs let the separate nodes reference each other
// so search engines and AI crawlers see one connected entity ("Pikoo").

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#app`;

export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    sameAs: ["https://github.com/vipulcha/pikoo"],
  };
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

export function appNode() {
  return {
    "@type": "WebApplication",
    "@id": APP_ID,
    name: SITE_NAME,
    alternateName: "Pikoo Pomodoro Timer",
    url: SITE_URL,
    description: SITE_SUMMARY,
    applicationCategory: "ProductivityApplication",
    applicationSubCategory: "Pomodoro timer",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and a modern web browser",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: FEATURE_LIST,
    screenshot: absoluteUrl("/opengraph-image"),
    publisher: { "@id": ORG_ID },
  };
}

export function faqNode(faqs: { q: string; a: string }[], pageUrl: string) {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function howToNode(name: string, steps: { name: string; text: string }[], pageUrl: string) {
  return {
    "@type": "HowTo",
    "@id": `${pageUrl}#howto`,
    name,
    tool: [{ "@type": "HowToTool", name: "Pikoo (free, in the browser)" }],
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      url: `${pageUrl}#step-${i + 1}`,
    })),
  };
}

export function homeGraph(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      appNode(),
      howToNode(
        "How to start a shared Pomodoro timer",
        [
          { name: "Create a room", text: "Open Pikoo and press Create Room. Optionally adjust the focus and break lengths." },
          { name: "Share the link", text: "Press Share Link and send it to the people you want to focus with." },
          { name: "Focus together", text: "Press play. Everyone in the room sees the same countdown and takes breaks at the same time." },
        ],
        SITE_URL
      ),
      faqNode(faqs, SITE_URL),
    ],
  };
}

export function guideGraph(guide: Guide) {
  const url = absoluteUrl(`/${guide.slug}`);
  const graph: object[] = [
    organizationNode(),
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: guide.title,
      headline: guide.h1,
      description: guide.description,
      inLanguage: "en",
      isPartOf: { "@id": SITE_ID },
      about: { "@id": APP_ID },
      dateModified: guide.updated,
      publisher: { "@id": ORG_ID },
      primaryImageOfPage: absoluteUrl(`/${guide.slug}/opengraph-image`),
      speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1", "[data-answer]"] },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: guide.label, item: url },
      ],
    },
    faqNode(guide.faqs, url),
  ];
  if (guide.steps) graph.push(howToNode(guide.h1, guide.steps, url));
  return { "@context": "https://schema.org", "@graph": graph };
}

// Serialize safely for a <script> tag (prevents "</script>" breaking out)
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
