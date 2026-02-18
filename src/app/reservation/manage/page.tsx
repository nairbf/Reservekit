import { prisma } from "@/lib/db";
import { ReservationManager } from "@/components/reservation-manager";
import type { Metadata } from "next";

function toSettingsMap(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export const dynamic = "force-dynamic";

async function getBrandingSettings() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: ["restaurantName", "accentColor", "logoUrl", "slug", "phone", "contactEmail"],
      },
    },
    select: { key: true, value: true },
  });
  return toSettingsMap(rows);
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBrandingSettings();
  const restaurantName = settings.restaurantName || "Restaurant";
  const title = `Manage Reservation — ${restaurantName}`;
  const description = `View, modify, or cancel your reservation at ${restaurantName}.`;
  const slug = settings.slug || "app";
  const url = `https://${slug}.reservesit.com/reservation/manage`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: url,
    },
  };
}

export default async function ReservationManagePage() {
  const settings = await getBrandingSettings();

  return (
    <ReservationManager
      restaurantName={settings.restaurantName || "Restaurant"}
      accentColor={settings.accentColor || "#1e3a5f"}
      logoUrl={settings.logoUrl || ""}
      slug={settings.slug || ""}
      phone={settings.phone || ""}
      email={settings.contactEmail || ""}
    />
  );
}
