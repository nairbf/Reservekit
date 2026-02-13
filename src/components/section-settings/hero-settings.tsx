"use client";

import { useEffect, useMemo, useState } from "react";
import FileUpload from "@/components/file-upload";

type SaveHandler = (patch: Record<string, string>) => Promise<void> | void;

const ACCENT_PRESETS = [
  { label: "Navy", value: "#1e3a5f" },
  { label: "Forest", value: "#2d5016" },
  { label: "Burgundy", value: "#5f1e2e" },
  { label: "Slate", value: "#3f4f5f" },
  { label: "Gold", value: "#5f4b1e" },
];

type CtaTarget = "reserve" | "menu" | "events" | "custom";

function defaultReserveLink(slug: string): string {
  return `/reserve/${encodeURIComponent(slug || "reef")}`;
}

function inferTarget(link: string, slug: string): CtaTarget {
  const normalized = String(link || "").trim();
  if (!normalized || normalized === defaultReserveLink(slug)) return "reserve";
  if (normalized === "/menu") return "menu";
  if (normalized === "/events") return "events";
  return "custom";
}

function targetToLink(target: CtaTarget, customValue: string, slug: string): string {
  if (target === "reserve") return defaultReserveLink(slug);
  if (target === "menu") return "/menu";
  if (target === "events") return "/events";
  return String(customValue || "").trim();
}

function extractUploadedFilename(url: string, category: string): string | null {
  const prefix = `/api/uploads/serve/${category}/`;
  if (!String(url || "").startsWith(prefix)) return null;
  const raw = String(url).slice(prefix.length).split("?")[0];
  return raw ? decodeURIComponent(raw) : null;
}

export default function HeroSettings({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: SaveHandler;
}) {
  const slug = settings.slug || "reef";

  const [restaurantNameOverride, setRestaurantNameOverride] = useState(settings.heroRestaurantName || "");
  const [tagline, setTagline] = useState(settings.tagline || "");
  const [announcementText, setAnnouncementText] = useState(settings.announcementText || "");
  const [heroImageUrl, setHeroImageUrl] = useState(settings.heroImageUrl || "");
  const [accentColor, setAccentColor] = useState(settings.accentColor || "#1e3a5f");
  const [primaryText, setPrimaryText] = useState(settings.primaryCtaText || "Reserve a Table");
  const [primaryTarget, setPrimaryTarget] = useState<CtaTarget>(inferTarget(settings.primaryCtaLink || "", slug));
  const [primaryCustom, setPrimaryCustom] = useState(primaryTarget === "custom" ? settings.primaryCtaLink || "" : "");
  const [secondaryText, setSecondaryText] = useState(settings.secondaryCtaText || "View Menu");
  const [secondaryTarget, setSecondaryTarget] = useState<CtaTarget>(inferTarget(settings.secondaryCtaLink || "/menu", slug));
  const [secondaryCustom, setSecondaryCustom] = useState(secondaryTarget === "custom" ? settings.secondaryCtaLink || "" : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRestaurantNameOverride(settings.heroRestaurantName || "");
    setTagline(settings.tagline || "");
    setAnnouncementText(settings.announcementText || "");
    setHeroImageUrl(settings.heroImageUrl || "");
    setAccentColor(settings.accentColor || "#1e3a5f");

    const nextPrimaryTarget = inferTarget(settings.primaryCtaLink || "", slug);
    setPrimaryTarget(nextPrimaryTarget);
    setPrimaryText(settings.primaryCtaText || "Reserve a Table");
    setPrimaryCustom(nextPrimaryTarget === "custom" ? settings.primaryCtaLink || "" : "");

    const nextSecondaryTarget = inferTarget(settings.secondaryCtaLink || "/menu", slug);
    setSecondaryTarget(nextSecondaryTarget);
    setSecondaryText(settings.secondaryCtaText || "View Menu");
    setSecondaryCustom(nextSecondaryTarget === "custom" ? settings.secondaryCtaLink || "" : "");
  }, [settings, slug]);

  const accentFromPreset = useMemo(() => {
    return ACCENT_PRESETS.some((preset) => preset.value.toLowerCase() === accentColor.toLowerCase())
      ? accentColor
      : "custom";
  }, [accentColor]);

  async function saveSection() {
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        heroRestaurantName: restaurantNameOverride,
        tagline,
        announcementText,
        heroImageUrl,
        accentColor,
        primaryCtaText: primaryText,
        primaryCtaLink: targetToLink(primaryTarget, primaryCustom, slug),
        secondaryCtaText: secondaryText,
        secondaryCtaLink: targetToLink(secondaryTarget, secondaryCustom, slug),
      });
      setMessage("Hero settings saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeHeroImage() {
    const filename = extractUploadedFilename(heroImageUrl, "hero");
    if (filename) {
      await fetch(`/api/uploads/${encodeURIComponent(filename)}?category=hero`, { method: "DELETE" }).catch(() => {});
    }
    setHeroImageUrl("");
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <FileUpload
          accept="image"
          category="hero"
          currentUrl={heroImageUrl}
          label="Hero image"
          hint="Recommended: 1920x1080 JPG"
          onUpload={(url) => setHeroImageUrl(url)}
          onRemove={heroImageUrl ? removeHeroImage : undefined}
        />
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Restaurant name override (optional)</label>
            <input value={restaurantNameOverride} onChange={(e) => setRestaurantNameOverride(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tagline</label>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Announcement text</label>
            <input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" placeholder="Leave blank to hide" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Accent preset</label>
          <select
            value={accentFromPreset}
            onChange={(e) => {
              if (e.target.value !== "custom") setAccentColor(e.target.value);
            }}
            className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
          >
            {ACCENT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label} ({preset.value})</option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Custom accent hex</label>
          <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" placeholder="#1e3a5f" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm font-semibold">Primary CTA</p>
          <input value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} className="h-10 w-full rounded border border-gray-200 px-3 text-sm" placeholder="Reserve a Table" />
          <select value={primaryTarget} onChange={(e) => setPrimaryTarget(e.target.value as CtaTarget)} className="h-10 w-full rounded border border-gray-200 px-3 text-sm">
            <option value="reserve">Reserve Page</option>
            <option value="menu">Menu Page</option>
            <option value="events">Events Page</option>
            <option value="custom">Custom URL</option>
          </select>
          {primaryTarget === "custom" ? (
            <input value={primaryCustom} onChange={(e) => setPrimaryCustom(e.target.value)} className="h-10 w-full rounded border border-gray-200 px-3 text-sm" placeholder="https://..." />
          ) : null}
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm font-semibold">Secondary CTA</p>
          <input value={secondaryText} onChange={(e) => setSecondaryText(e.target.value)} className="h-10 w-full rounded border border-gray-200 px-3 text-sm" placeholder="View Menu" />
          <select value={secondaryTarget} onChange={(e) => setSecondaryTarget(e.target.value as CtaTarget)} className="h-10 w-full rounded border border-gray-200 px-3 text-sm">
            <option value="menu">Menu Page</option>
            <option value="reserve">Reserve Page</option>
            <option value="events">Events Page</option>
            <option value="custom">Custom URL</option>
          </select>
          {secondaryTarget === "custom" ? (
            <input value={secondaryCustom} onChange={(e) => setSecondaryCustom(e.target.value)} className="h-10 w-full rounded border border-gray-200 px-3 text-sm" placeholder="https://..." />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={saveSection} disabled={saving} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Hero"}
        </button>
        {message ? <span className="text-sm text-green-700">{message}</span> : null}
      </div>
    </div>
  );
}
