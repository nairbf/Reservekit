import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { EventDetailPageClient } from "@/components/event-detail-page";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function toSettingsMap(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: eventSlug } = await params;

  const [event, settingRows] = await Promise.all([
    prisma.event.findUnique({
      where: { slug: eventSlug },
      select: { name: true, description: true, imageUrl: true, slug: true },
    }),
    prisma.setting.findMany({
      where: { key: { in: ["restaurantName", "slug", "heroImageUrl"] } },
      select: { key: true, value: true },
    }),
  ]);

  const settings = toSettingsMap(settingRows);
  const restaurantName = settings.restaurantName || "Restaurant";
  const slug = (settings.slug || "app").trim() || "app";
  const baseUrl = `https://${slug}.reservesit.com`;

  if (!event) {
    return {
      title: `Event — ${restaurantName}`,
      description: `Browse upcoming events at ${restaurantName}.`,
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: `${baseUrl}/events`,
      },
    };
  }

  const title = `${event.name} — ${restaurantName}`;
  const description = event.description || `Join us for ${event.name} at ${restaurantName}.`;
  const image = event.imageUrl || settings.heroImageUrl || "";
  const url = `${baseUrl}/events/${event.slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      ...(image ? { images: [{ url: image, alt: event.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <EventDetailPageClient slug={slug} />;
}
