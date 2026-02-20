"use client";

import { useEffect, useMemo, useState } from "react";
import AboutSettings from "@/components/section-settings/about-settings";
import ContactSettings from "@/components/section-settings/contact-settings";
import EventsSettings from "@/components/section-settings/events-settings";
import HeroSettings from "@/components/section-settings/hero-settings";
import HoursSettings from "@/components/section-settings/hours-settings";
import MenuSettings from "@/components/section-settings/menu-settings";

export type LandingSectionId = "hero" | "about" | "menu" | "events" | "hours" | "contact";

export interface LandingSection {
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

function normalizeSections(raw: string | undefined): LandingSection[] {
  if (!raw) return DEFAULT_SECTIONS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_SECTIONS;

    const map = new Map<LandingSectionId, LandingSection>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const candidate = row as Partial<LandingSection>;
      const id = String(candidate.id || "") as LandingSectionId;
      const def = DEFAULT_SECTIONS.find((section) => section.id === id);
      if (!def) continue;
      map.set(id, {
        id,
        label: String(candidate.label || def.label),
        visible: candidate.visible !== false,
        order: Number.isFinite(Number(candidate.order)) ? Math.trunc(Number(candidate.order)) : def.order,
      });
    }

    const merged = DEFAULT_SECTIONS.map((section) => map.get(section.id) || section);
    return merged.sort((a, b) => a.order - b.order).map((section, index) => ({ ...section, order: index }));
  } catch {
    return DEFAULT_SECTIONS;
  }
}

function sectionSubtext(id: LandingSectionId): string {
  if (id === "hero") return "Top banner, image, CTA";
  if (id === "about") return "Welcome heading and description";
  if (id === "menu") return "Menu preview behavior";
  if (id === "events") return "Upcoming events block";
  if (id === "hours") return "Operating hours and address";
  return "Contact links and footer copy";
}

export default function LandingBuilder({
  settings,
  onSavePartial,
}: {
  settings: Record<string, string>;
  onSavePartial: (patch: Record<string, string>) => Promise<void>;
}) {
  const [sections, setSections] = useState<LandingSection[]>(normalizeSections(settings.landing_sections));
  const [expandedId, setExpandedId] = useState<LandingSectionId | null>(null);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");

  useEffect(() => {
    setSections(normalizeSections(settings.landing_sections));
  }, [settings.landing_sections]);

  const sorted = useMemo(
    () => [...sections].sort((a, b) => a.order - b.order),
    [sections],
  );

  function moveSection(id: LandingSectionId, direction: "up" | "down") {
    const index = sorted.findIndex((section) => section.id === id);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return;

    const next = [...sorted];
    const [current] = next.splice(index, 1);
    next.splice(nextIndex, 0, current);

    setSections(next.map((section, idx) => ({ ...section, order: idx })));
  }

  function toggleVisible(id: LandingSectionId) {
    setSections((previous) => previous.map((section) => (section.id === id ? { ...section, visible: !section.visible } : section)));
  }

  async function saveLayout() {
    setLayoutSaving(true);
    setLayoutMessage("");
    try {
      const payload = sorted.map((section, index) => ({ ...section, order: index }));
      await onSavePartial({ landing_sections: JSON.stringify(payload) });
      setLayoutMessage("Section layout saved.");
    } finally {
      setLayoutSaving(false);
    }
  }

  function sectionSettings(id: LandingSectionId) {
    if (id === "hero") return <HeroSettings settings={settings} onSave={onSavePartial} />;
    if (id === "about") return <AboutSettings settings={settings} onSave={onSavePartial} />;
    if (id === "menu") return <MenuSettings settings={settings} onSave={onSavePartial} />;
    if (id === "events") return <EventsSettings settings={settings} onSave={onSavePartial} />;
    if (id === "hours") return <HoursSettings settings={settings} onSave={onSavePartial} />;
    return <ContactSettings settings={settings} onSave={onSavePartial} />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Landing Page Sections</h3>
            <p className="text-sm text-gray-500">Reorder and toggle sections. Expand a row to edit content.</p>
          </div>
          <button
            onClick={saveLayout}
            disabled={layoutSaving}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70"
          >
            {layoutSaving ? "Saving..." : "Save Layout"}
          </button>
        </div>

        <div className="space-y-3">
          {sorted.map((section, index) => {
            const expanded = expandedId === section.id;
            return (
              <div key={section.id} className="rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span className="text-gray-400">⋮⋮</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{section.label}</p>
                    <p className="text-xs text-gray-500">{sectionSubtext(section.id)}</p>
                  </div>

                  <button onClick={() => moveSection(section.id, "up")} disabled={index === 0} className="h-8 rounded border border-gray-200 px-2 text-xs disabled:opacity-40">↑</button>
                  <button onClick={() => moveSection(section.id, "down")} disabled={index === sorted.length - 1} className="h-8 rounded border border-gray-200 px-2 text-xs disabled:opacity-40">↓</button>
                  <button
                    onClick={() => toggleVisible(section.id)}
                    className={`h-8 rounded border px-2 text-xs ${section.visible ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-100 text-gray-600"}`}
                    title={section.visible ? "Hide section" : "Show section"}
                  >
                    {section.visible ? "👁" : "🙈"}
                  </button>
                  <button onClick={() => setExpandedId(expanded ? null : section.id)} className="h-8 rounded border border-gray-200 px-2 text-xs">
                    {expanded ? "▾" : "▸"}
                  </button>
                </div>

                {expanded ? <div className="border-t border-gray-100 p-3">{sectionSettings(section.id)}</div> : null}
              </div>
            );
          })}
        </div>

        {layoutMessage ? <p className="mt-3 text-sm text-green-700">{layoutMessage}</p> : null}
      </section>

      <aside className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-base font-bold">Live Preview</h3>
          <p className="mt-1 text-sm text-gray-500">Open your public homepage in a new tab.</p>
          <a href="/" target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700">
            Preview Landing Page →
          </a>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-800">Section Order</h4>
          <div className="mt-3 space-y-2">
            {sorted.map((section) => (
              <div
                key={`preview-${section.id}`}
                className={`rounded-lg border px-3 py-2 text-sm ${section.visible ? "border-blue-200 bg-blue-50 text-blue-900" : "border-gray-200 bg-gray-100 text-gray-500"}`}
              >
                {section.label} {section.visible ? "" : "(Hidden)"}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
