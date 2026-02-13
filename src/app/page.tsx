import { ContactFooter } from "@/components/landing/contact-footer";
import { EventsSection } from "@/components/landing/events-section";
import { Hero } from "@/components/landing/hero";
import { HoursSection } from "@/components/landing/hours-section";
import { MenuSection } from "@/components/landing/menu-section";
import { Reveal } from "@/components/landing/reveal";
import { prisma } from "@/lib/db";
import { getMenuFiles } from "@/lib/menu-files";

export const dynamic = "force-dynamic";

type SettingsMap = Record<string, string>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value.trim());
}

function buildSettingMap(rows: Array<{ key: string; value: string }>): SettingsMap {
  const map: SettingsMap = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function parseWeeklyHours(settings: SettingsMap) {
  const defaultOpen = settings.openTime || "17:00";
  const defaultClose = settings.closeTime || "22:00";

  const fallback = DAY_KEYS.map(day => ({
    day: DAY_LABELS[day],
    isClosed: false,
    openTime: defaultOpen,
    closeTime: defaultClose,
  }));

  const raw = settings.weeklySchedule;
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Record<string, { isClosed?: boolean; openTime?: string; closeTime?: string }>;
    return DAY_KEYS.map(day => {
      const row = parsed[day] || {};
      return {
        day: DAY_LABELS[day],
        isClosed: Boolean(row.isClosed),
        openTime: row.openTime || defaultOpen,
        closeTime: row.closeTime || defaultClose,
      };
    });
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [settingRows, menuFiles, categoriesRaw, eventsRaw] = await Promise.all([
    prisma.setting.findMany({
      where: {
        NOT: [
          { key: { startsWith: "pos_status_" } },
          { key: { startsWith: "spoton_table_" } },
          { key: { startsWith: "loyalty_phone_" } },
        ],
      },
    }),
    getMenuFiles(),
    prisma.menuCategory.findMany({
      where: { isActive: true },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.event.findMany({
      where: {
        isActive: true,
        date: { gte: new Date().toISOString().slice(0, 10) },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 4,
    }),
  ]);

  const settings = buildSettingMap(settingRows);
  const restaurantName = settings.restaurantName || "The Reef Restaurant";
  const slug = settings.slug || "reef";
  const reserveHref = `/reserve/${encodeURIComponent(slug)}`;
  const menuHref = "/menu";
  const accentColor = isHexColor(settings.accentColor || "") ? settings.accentColor : "#1e3a5f";
  const tagline = settings.tagline || "Modern coastal cuisine in the heart of downtown";
  const description = settings.description || "At Reef, we celebrate the ocean's bounty with locally sourced ingredients and thoughtful service in a warm, modern dining room.";
  const announcementText = settings.announcementText || "";
  const heroImageUrl = settings.heroImageUrl || "";
  const logoUrl = settings.logoUrl || "";
  const address = settings.address || "";
  const phone = settings.phone || "";
  const contactEmail = settings.contactEmail || "";
  const socialInstagram = settings.socialInstagram || "";
  const socialFacebook = settings.socialFacebook || "";

  const categories = categoriesRaw.filter(category => category.items.length > 0);
  const hours = parseWeeklyHours(settings);

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <Hero
        restaurantName={restaurantName}
        tagline={tagline}
        announcementText={announcementText}
        heroImageUrl={heroImageUrl}
        logoUrl={logoUrl}
        reserveHref={reserveHref}
        menuHref={menuHref}
        accentColor={accentColor}
      />

      <Reveal>
        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Welcome</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 font-serif">A dining room built for meaningful evenings.</h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-700">{description}</p>
        </section>
      </Reveal>

      {menuFiles.length > 0 || categories.length > 0 ? (
        <Reveal>
          <MenuSection categories={categories} menuFiles={menuFiles} accentColor={accentColor} />
        </Reveal>
      ) : null}

      {eventsRaw.length > 0 ? (
        <Reveal>
          <EventsSection events={eventsRaw} accentColor={accentColor} />
        </Reveal>
      ) : null}

      <Reveal>
        <HoursSection hours={hours} address={address} accentColor={accentColor} />
      </Reveal>

      <ContactFooter
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        phone={phone}
        email={contactEmail}
        address={address}
        socialInstagram={socialInstagram}
        socialFacebook={socialFacebook}
      />
    </main>
  );
}
