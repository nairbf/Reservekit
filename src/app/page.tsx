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

type LandingSectionId = "hero" | "about" | "menu" | "events" | "hours" | "contact";

interface LandingSection {
  id: LandingSectionId;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_SECTIONS: LandingSection[] = [
  { id: "hero", label: "Hero Banner", visible: true, order: 0 },
  { id: "about", label: "About", visible: true, order: 1 },
  { id: "menu", label: "Menu", visible: true, order: 2 },
  { id: "events", label: "Upcoming Events", visible: true, order: 3 },
  { id: "hours", label: "Hours & Location", visible: true, order: 4 },
  { id: "contact", label: "Contact", visible: true, order: 5 },
];

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

function toInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function buildSettingMap(rows: Array<{ key: string; value: string }>): SettingsMap {
  const map: SettingsMap = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function parseWeeklyHours(settings: SettingsMap) {
  const defaultOpen = settings.openTime || "17:00";
  const defaultClose = settings.closeTime || "22:00";

  const fallback = DAY_KEYS.map((day) => ({
    day: DAY_LABELS[day],
    isClosed: false,
    openTime: defaultOpen,
    closeTime: defaultClose,
  }));

  const raw = settings.weeklySchedule;
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Record<string, { isClosed?: boolean; openTime?: string; closeTime?: string }>;
    return DAY_KEYS.map((day) => {
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

function parseLandingSections(raw: string | undefined): LandingSection[] {
  if (!raw) return DEFAULT_SECTIONS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_SECTIONS;

    const map = new Map<LandingSectionId, LandingSection>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const candidate = row as Partial<LandingSection>;
      const id = String(candidate.id || "") as LandingSectionId;
      const fallback = DEFAULT_SECTIONS.find((section) => section.id === id);
      if (!fallback) continue;
      map.set(id, {
        id,
        label: String(candidate.label || fallback.label),
        visible: candidate.visible !== false,
        order: Number.isFinite(Number(candidate.order)) ? Math.trunc(Number(candidate.order)) : fallback.order,
      });
    }

    const merged = DEFAULT_SECTIONS.map((section) => map.get(section.id) || section);
    return merged.sort((a, b) => a.order - b.order).map((section, index) => ({ ...section, order: index }));
  } catch {
    return DEFAULT_SECTIONS;
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
      take: 12,
    }),
  ]);

  const settings = buildSettingMap(settingRows);
  const sections = parseLandingSections(settings.landing_sections)
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order);

  const restaurantName = settings.restaurantName || "The Reef Restaurant";
  const heroRestaurantName = settings.heroRestaurantName || restaurantName;
  const slug = settings.slug || "reef";
  const reserveHref = `/reserve/${encodeURIComponent(slug)}`;
  const accentColor = isHexColor(settings.accentColor || "") ? settings.accentColor : "#1e3a5f";
  const tagline = settings.tagline || "Modern coastal cuisine in the heart of downtown";
  const description = settings.description || "At Reef, we celebrate the ocean's bounty with locally sourced ingredients and thoughtful service in a warm, modern dining room.";
  const welcomeHeading = settings.welcomeHeading || "A dining room built for meaningful evenings.";
  const announcementText = settings.announcementText || "";
  const heroImageUrl = settings.heroImageUrl || "";
  const logoUrl = settings.logoUrl || "";
  const address = settings.address || "";
  const phone = settings.phone || "";
  const contactEmail = settings.contactEmail || "";
  const socialInstagram = settings.socialInstagram || "";
  const socialFacebook = settings.socialFacebook || "";
  const footerTagline = settings.footerTagline || "Join us for seasonal cuisine, thoughtful service, and a dining room built for memorable nights.";

  const primaryCtaText = settings.primaryCtaText || "Reserve a Table";
  const primaryCtaLink = settings.primaryCtaLink || reserveHref;
  const secondaryCtaText = settings.secondaryCtaText || "View Menu";
  const secondaryCtaLink = settings.secondaryCtaLink || "/menu";

  const categories = categoriesRaw.filter((category) => category.items.length > 0);
  const hours = parseWeeklyHours(settings);

  const showAddressInHours = (settings.hoursShowAddress || (address ? "true" : "false")) === "true";
  const menuPreviewEnabled = (settings.menuPreviewEnabled || "true") === "true";
  const eventsMaxCount = Math.max(1, Math.min(12, toInt(settings.eventsMaxCount, 4)));
  const eventsAutoHide = (settings.eventsAutoHideWhenEmpty || "true") === "true";

  function renderSection(section: LandingSection) {
    if (section.id === "hero") {
      return (
        <Hero
          restaurantName={heroRestaurantName}
          tagline={tagline}
          announcementText={announcementText}
          heroImageUrl={heroImageUrl}
          logoUrl={logoUrl}
          reserveHref={reserveHref}
          menuHref="/menu"
          primaryCtaText={primaryCtaText}
          primaryCtaLink={primaryCtaLink}
          secondaryCtaText={secondaryCtaText}
          secondaryCtaLink={secondaryCtaLink}
          accentColor={accentColor}
        />
      );
    }

    if (section.id === "about") {
      return (
        <Reveal>
          <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Welcome</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 font-serif">{welcomeHeading}</h2>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-700">{description}</p>
          </section>
        </Reveal>
      );
    }

    if (section.id === "menu") {
      if (menuFiles.length === 0 && categories.length === 0) return null;
      return (
        <Reveal>
          <MenuSection
            categories={categories}
            menuFiles={menuFiles}
            accentColor={accentColor}
            showPreview={menuPreviewEnabled}
          />
        </Reveal>
      );
    }

    if (section.id === "events") {
      if (eventsRaw.length === 0 && eventsAutoHide) return null;
      return (
        <Reveal>
          {eventsRaw.length > 0 ? (
            <EventsSection events={eventsRaw} accentColor={accentColor} maxEvents={eventsMaxCount} />
          ) : (
            <section className="bg-stone-50/80">
              <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
                <h2 className="text-3xl font-semibold tracking-tight text-gray-900 font-serif">Upcoming Events</h2>
                <p className="mt-3 text-sm text-gray-600">No events are currently scheduled. Check back soon.</p>
              </div>
            </section>
          )}
        </Reveal>
      );
    }

    if (section.id === "hours") {
      return (
        <Reveal>
          <HoursSection hours={hours} address={showAddressInHours ? address : ""} accentColor={accentColor} />
        </Reveal>
      );
    }

    if (section.id === "contact") {
      return (
        <ContactFooter
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          footerTagline={footerTagline}
          phone={phone}
          email={contactEmail}
          address={address}
          socialInstagram={socialInstagram}
          socialFacebook={socialFacebook}
        />
      );
    }

    return null;
  }

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      {sections.map((section) => (
        <div key={section.id}>{renderSection(section)}</div>
      ))}

      <div className="border-t border-slate-800 bg-slate-900 px-6 py-4 text-center text-xs text-slate-400">
        Powered by ReserveSit
      </div>
    </main>
  );
}
