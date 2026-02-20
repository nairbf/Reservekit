import Image from "next/image";
import Link from "next/link";
import { getAppUrl } from "@/lib/app-url";
import { AnnouncementBanner } from "@/components/landing/announcement-banner";

interface HeroProps {
  restaurantName: string;
  tagline?: string;
  announcementText?: string;
  heroImageUrl?: string;
  logoUrl?: string;
  reserveHref?: string;
  menuHref?: string;
  primaryCtaText?: string;
  primaryCtaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  accentColor: string;
}

export async function Hero({
  restaurantName,
  tagline,
  announcementText,
  heroImageUrl,
  logoUrl,
  reserveHref,
  menuHref,
  primaryCtaText = "Reserve a Table",
  primaryCtaLink,
  secondaryCtaText = "View Menu",
  secondaryCtaLink,
  accentColor,
}: HeroProps) {
  const primaryHref = primaryCtaLink || reserveHref || "/reserve/reef";
  const secondaryHref = secondaryCtaLink || menuHref || "/menu";
  const appUrl = await getAppUrl();
  const isDemoEnv = appUrl.includes("demo.reservesit.com");

  return (
    <>
      {isDemoEnv ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          You are viewing a demo of ReserveSit.{" "}
          <a href="https://reservesit.com/pricing" className="font-semibold underline">
            Get your own instance →
          </a>
        </div>
      ) : null}
      <section className="relative isolate min-h-[72vh] overflow-hidden">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={`${restaurantName} interior`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/70" />

        <div className="relative mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-center px-6 py-16 text-white sm:px-8 lg:px-10">
          <AnnouncementBanner text={announcementText || ""} />

          {logoUrl ? (
            <div className="mt-4">
              <Image
                src={logoUrl}
                alt={`${restaurantName} logo`}
                width={220}
                height={80}
                className="h-14 w-auto object-contain"
              />
            </div>
          ) : null}

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight font-serif sm:text-5xl lg:text-6xl">
            {restaurantName}
          </h1>

          <p className="mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
            {tagline || "Modern coastal cuisine in the heart of downtown"}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={primaryHref}
              className="inline-flex min-h-11 items-center justify-center rounded-md px-6 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:translate-y-[-1px]"
              style={{ backgroundColor: accentColor }}
            >
              {primaryCtaText}
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/35 bg-white/10 px-6 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/20"
            >
              {secondaryCtaText}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
