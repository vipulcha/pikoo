import { renderOgImage, OG_SIZE } from "@/lib/og";
import { GUIDES, getGuide } from "@/lib/guides";

export const alt = "Pikoo guide";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  return renderOgImage(guide?.h1 ?? "Pikoo", guide?.description ?? "");
}
