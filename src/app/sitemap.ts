import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugSetting, events] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "slug" }, select: { value: true } }),
    prisma.event.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const slug = (slugSetting?.value || "app").trim() || "app";
  const baseUrl = `https://${slug}.reservesit.com`;
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/menu`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/events`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...events.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: `${baseUrl}/reserve/${slug}`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
  ];
}
