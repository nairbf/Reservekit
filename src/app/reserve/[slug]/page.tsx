import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import ReserveWidgetClient from "./ReserveWidgetClient";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function toSettingsMap(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: routeSlug } = await params;
  const settingRows = await prisma.setting.findMany({
    where: { key: { in: ["restaurantName", "tagline", "description", "heroImageUrl", "slug"] } },
    select: { key: true, value: true },
  });
  const settings = toSettingsMap(settingRows);
  const restaurantName = settings.restaurantName || "Restaurant";
  const description =
    settings.description ||
    settings.tagline ||
    `Book your table at ${restaurantName}. Easy online reservations.`;
  const image = settings.heroImageUrl || "";
  const slug = routeSlug || settings.slug || "app";
  const url = `https://${slug}.reservesit.com/reserve/${slug}`;
  const title = `Reserve a Table — ${restaurantName}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      ...(image ? { images: [{ url: image, alt: restaurantName }] } : {}),
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

export default async function ReserveWidget() {
  const settings = await getSettings();
  return (
    <ReserveWidgetClient
      restaurantName={settings.restaurantName}
      reserveHeading={settings.reserveHeading}
      reserveSubheading={settings.reserveSubheading}
      reserveConfirmationMessage={settings.reserveConfirmationMessage}
      reserveRequestDisclaimer={settings.reserveRequestDisclaimer}
      reserveRequestPlaceholder={settings.reserveRequestPlaceholder}
      reserveRequestSamples={settings.reserveRequestSamples}
      loyaltyOptInEnabled={settings.loyaltyOptInEnabled}
      loyaltyProgramName={settings.loyaltyProgramName}
      loyaltyOptInMessage={settings.loyaltyOptInMessage}
      loyaltyOptInLabel={settings.loyaltyOptInLabel}
      depositsEnabled={settings.depositEnabled}
      depositType={settings.depositType}
      depositAmount={settings.depositAmount}
      depositMinParty={settings.depositMinPartySize}
      depositMessage={settings.depositMessage}
      expressDiningEnabled={settings.expressDiningEnabled}
      expressDiningMessage={settings.expressDiningMessage}
    />
  );
}
