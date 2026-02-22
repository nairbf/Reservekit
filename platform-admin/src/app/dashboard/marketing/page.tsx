"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { DEFAULT_FAQ_ITEMS, DEFAULT_MARKETING_SETTINGS } from "@/lib/marketing-defaults";

type MessageType = "success" | "error";
type SaveSource = "manual" | "auto";
type SectionId =
  | "home.hero"
  | "home.features"
  | "home.demo"
  | "about.content"
  | "faq.items"
  | "demo.content"
  | "media.images";

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

interface SectionMessage {
  type: MessageType;
  text: string;
}

interface PageGroup {
  id: string;
  icon: string;
  label: string;
  sections: Array<{ id: SectionId; label: string }>;
}

const PAGE_GROUPS: PageGroup[] = [
  {
    id: "home",
    icon: "🏠",
    label: "Home",
    sections: [
      { id: "home.hero", label: "Hero" },
      { id: "home.features", label: "Features + Integrations" },
      { id: "home.demo", label: "Demo Stripe" },
    ],
  },
  {
    id: "about",
    icon: "ℹ️",
    label: "About",
    sections: [{ id: "about.content", label: "Page Content" }],
  },
  {
    id: "faq",
    icon: "❓",
    label: "FAQ",
    sections: [{ id: "faq.items", label: "Question List" }],
  },
  {
    id: "demo",
    icon: "🎬",
    label: "Demo Page",
    sections: [{ id: "demo.content", label: "Page Content" }],
  },
];

const MEDIA_GROUP: PageGroup = {
  id: "media",
  icon: "🖼️",
  label: "Images & Assets",
  sections: [{ id: "media.images", label: "Hero Image" }],
};

const SECTION_TITLES: Record<SectionId, string> = {
  "home.hero": "Hero Section",
  "home.features": "Features & Integrations",
  "home.demo": "Demo Highlight",
  "about.content": "About Page",
  "faq.items": "FAQ Editor",
  "demo.content": "Demo Page",
  "media.images": "Image Assets",
};

function normalizeSettings(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (typeof value === "string") normalized[key] = value;
  }

  return normalized;
}

function parseFaqItems(raw: string | undefined): FaqItem[] {
  const fallback = DEFAULT_FAQ_ITEMS.map((item, index) => ({ ...item, id: `default-${index}` }));
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;

    const items = parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { q?: unknown; a?: unknown };
        const q = String(row.q || "").trim();
        const a = String(row.a || "").trim();
        if (!q || !a) return null;
        return { id: `faq-${index}-${Date.now()}`, q, a };
      })
      .filter((item): item is FaqItem => Boolean(item));

    return items.length > 0 ? items : fallback;
  } catch {
    return fallback;
  }
}

function faqToJson(items: FaqItem[]) {
  const normalized = items
    .map((item) => ({ q: item.q.trim(), a: item.a.trim() }))
    .filter((item) => item.q && item.a);

  return JSON.stringify(normalized);
}

function charCount(value: string | undefined) {
  return String(value || "").length;
}

export default function MarketingEditorPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSection, setActiveSection] = useState<SectionId>("home.hero");
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({
    home: true,
    about: true,
    faq: true,
    demo: true,
    media: true,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draft, setDraft] = useState<Record<string, string>>(DEFAULT_MARKETING_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Record<string, string>>(DEFAULT_MARKETING_SETTINGS);
  const [faqItems, setFaqItems] = useState<FaqItem[]>(parseFaqItems(DEFAULT_MARKETING_SETTINGS.faq_items));

  const [saving, setSaving] = useState<Record<SectionId, boolean>>({} as Record<SectionId, boolean>);
  const [messages, setMessages] = useState<Record<SectionId, SectionMessage>>({} as Record<SectionId, SectionMessage>);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  function setField(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function togglePage(pageId: string) {
    setExpandedPages((prev) => ({ ...prev, [pageId]: !prev[pageId] }));
  }

  function setSectionMessage(section: SectionId, type: MessageType, text: string) {
    setMessages((prev) => ({ ...prev, [section]: { type, text } }));
  }

  function sectionPatch(section: SectionId): Record<string, string> {
    if (section === "home.hero") {
      return {
        hero_badge: draft.hero_badge || "",
        hero_headline: draft.hero_headline || "",
        hero_subheadline: draft.hero_subheadline || "",
        hero_cta_primary_text: draft.hero_cta_primary_text || "",
        hero_cta_primary_url: draft.hero_cta_primary_url || "",
        hero_cta_secondary_text: draft.hero_cta_secondary_text || "",
        hero_cta_secondary_url: draft.hero_cta_secondary_url || "",
      };
    }

    if (section === "home.features") {
      return {
        features_headline: draft.features_headline || "",
        features_subheadline: draft.features_subheadline || "",
        integrations_list: draft.integrations_list || "",
      };
    }

    if (section === "home.demo") {
      return {
        demo_section_headline: draft.demo_section_headline || "",
        demo_section_body: draft.demo_section_body || "",
      };
    }

    if (section === "about.content") {
      return {
        about_headline: draft.about_headline || "",
        about_body: draft.about_body || "",
      };
    }

    if (section === "faq.items") {
      return {
        faq_items: faqToJson(faqItems),
      };
    }

    if (section === "demo.content") {
      return {
        demo_page_headline: draft.demo_page_headline || "",
        demo_page_body: draft.demo_page_body || "",
      };
    }

    return {
      hero_image: draft.hero_image || "",
    };
  }

  const sectionSignatures = useMemo(
    () => ({
      "home.hero": JSON.stringify(sectionPatch("home.hero")),
      "home.features": JSON.stringify(sectionPatch("home.features")),
      "home.demo": JSON.stringify(sectionPatch("home.demo")),
      "about.content": JSON.stringify(sectionPatch("about.content")),
      "faq.items": JSON.stringify(sectionPatch("faq.items")),
      "demo.content": JSON.stringify(sectionPatch("demo.content")),
      "media.images": JSON.stringify(sectionPatch("media.images")),
    }),
    [draft, faqItems],
  );

  const dirtyBySection = useMemo(() => {
    const evaluate = (section: SectionId) => {
      const patch = sectionPatch(section);
      return Object.entries(patch).some(([key, value]) => (savedSettings[key] || "") !== value);
    };

    return {
      "home.hero": evaluate("home.hero"),
      "home.features": evaluate("home.features"),
      "home.demo": evaluate("home.demo"),
      "about.content": evaluate("about.content"),
      "faq.items": evaluate("faq.items"),
      "demo.content": evaluate("demo.content"),
      "media.images": evaluate("media.images"),
    } as Record<SectionId, boolean>;
  }, [draft, faqItems, savedSettings]);

  const hasUnsavedChanges = useMemo(
    () => Object.values(dirtyBySection).some(Boolean),
    [dirtyBySection],
  );

  async function loadSettings() {
    setLoading(true);
    setLoadError("");

    try {
      const res = await fetch("/api/marketing-settings", { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as { settings?: unknown; error?: string; detail?: string };

      if (!res.ok) {
        throw new Error(payload.error || payload.detail || "Failed to load marketing settings");
      }

      const saved = normalizeSettings(payload.settings);
      const merged = { ...DEFAULT_MARKETING_SETTINGS, ...saved };
      setDraft(merged);
      setSavedSettings(merged);
      setFaqItems(parseFaqItems(merged.faq_items));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load marketing settings";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveSection(section: SectionId, source: SaveSource) {
    const patch = sectionPatch(section);
    const hasChange = Object.entries(patch).some(([key, value]) => (savedSettings[key] || "") !== value);
    if (!hasChange) return;

    if (saving[section]) return;

    setSaving((prev) => ({ ...prev, [section]: true }));
    setSectionMessage(section, "success", "");

    try {
      const res = await fetch("/api/marketing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: patch }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string; detail?: string; settings?: unknown };
      if (!res.ok) {
        throw new Error(payload.error || payload.detail || "Failed to save changes");
      }

      const returned = normalizeSettings(payload.settings);
      const mergedPatch = { ...patch, ...returned };

      setSavedSettings((prev) => ({ ...prev, ...mergedPatch }));
      setDraft((prev) => ({ ...prev, ...mergedPatch }));

      if (mergedPatch.faq_items !== undefined) {
        setFaqItems(parseFaqItems(mergedPatch.faq_items));
      }

      setSectionMessage(section, "success", source === "auto" ? "Auto-saved" : "Saved");
      showToast(source === "auto" ? "Auto-saved." : "Changes saved.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save changes";
      setSectionMessage(section, "error", message);
      showToast(message, "error");
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!dirtyBySection[activeSection]) return;
    if (saving[activeSection]) return;

    const timer = window.setTimeout(() => {
      void saveSection(activeSection, "auto");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [activeSection, sectionSignatures[activeSection], dirtyBySection[activeSection], saving[activeSection], loading]);

  async function uploadImage(file: File) {
    setUploadingImage(true);
    setSectionMessage("media.images", "success", "");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/marketing-settings/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        url?: string;
        saved?: boolean;
      };

      if (!res.ok || !payload.url) {
        throw new Error(payload.error || payload.detail || "Upload failed");
      }

      setDraft((prev) => ({ ...prev, hero_image: payload.url || prev.hero_image }));
      if (payload.saved) {
        setSavedSettings((prev) => ({ ...prev, hero_image: payload.url || prev.hero_image }));
      }

      setSectionMessage("media.images", "success", payload.saved ? "Uploaded and saved" : "Uploaded");
      showToast("Image uploaded.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setSectionMessage("media.images", "error", message);
      showToast(message, "error");
    } finally {
      setUploadingImage(false);
      setDragActive(false);
    }
  }

  function addFaq() {
    setFaqItems((prev) => [...prev, { id: `faq-${Date.now()}`, q: "", a: "" }]);
  }

  function updateFaq(index: number, field: "q" | "a", value: string) {
    setFaqItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  }

  function removeFaq(index: number) {
    setFaqItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function onDropFaq(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;

    setFaqItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      if (!moved) return prev;
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDragIndex(null);
  }

  function renderSectionPreview(section: SectionId) {
    if (section === "home.hero") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-4">
          <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
            {draft.hero_badge || "Hero badge"}
          </p>
          <h3 className="mt-3 text-xl font-semibold text-slate-900">{draft.hero_headline || "Hero headline"}</h3>
          <p className="mt-2 text-sm text-slate-600">{draft.hero_subheadline || "Hero subheadline"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">{draft.hero_cta_primary_text || "CTA"}</span>
            <span className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">{draft.hero_cta_secondary_text || "CTA"}</span>
          </div>
        </div>
      );
    }

    if (section === "home.features") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-900">{draft.features_headline}</h3>
          <p className="mt-2 text-sm text-slate-600">{draft.features_subheadline}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {String(draft.integrations_list || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 5)
              .map((item) => (
                <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  {item}
                </span>
              ))}
          </div>
        </div>
      );
    }

    if (section === "home.demo") {
      return (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{draft.demo_section_headline}</p>
          <p className="mt-2 text-sm text-slate-700">{draft.demo_section_body}</p>
        </div>
      );
    }

    if (section === "about.content") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-900">{draft.about_headline}</h3>
          <p className="mt-2 text-sm text-slate-600">{draft.about_body}</p>
        </div>
      );
    }

    if (section === "faq.items") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{faqItems.length} items</p>
          <div className="mt-2 space-y-2">
            {faqItems.slice(0, 2).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-sm font-medium text-slate-900">{item.q}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (section === "demo.content") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-900">{draft.demo_page_headline}</h3>
          <p className="mt-2 text-sm text-slate-600">{draft.demo_page_body}</p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {draft.hero_image ? (
          <img src={draft.hero_image} alt="Hero preview" className="w-full rounded-lg border border-slate-200 bg-white" />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">
            No image selected.
          </div>
        )}
      </div>
    );
  }

  function renderSectionFields(section: SectionId) {
    if (section === "home.hero") {
      return (
        <div className="space-y-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Badge Text</span>
            <input
              value={draft.hero_badge || ""}
              onChange={(e) => setField("hero_badge", e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Headline</span>
              <span className="text-xs text-slate-400">{charCount(draft.hero_headline)}/120</span>
            </div>
            <textarea
              value={draft.hero_headline || ""}
              onChange={(e) => setField("hero_headline", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Subheadline</span>
              <span className="text-xs text-slate-400">{charCount(draft.hero_subheadline)}/240</span>
            </div>
            <textarea
              value={draft.hero_subheadline || ""}
              onChange={(e) => setField("hero_subheadline", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Primary CTA Text</span>
              <input
                value={draft.hero_cta_primary_text || ""}
                onChange={(e) => setField("hero_cta_primary_text", e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Primary CTA URL</span>
              <input
                value={draft.hero_cta_primary_url || ""}
                onChange={(e) => setField("hero_cta_primary_url", e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Secondary CTA Text</span>
              <input
                value={draft.hero_cta_secondary_text || ""}
                onChange={(e) => setField("hero_cta_secondary_text", e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Secondary CTA URL</span>
              <input
                value={draft.hero_cta_secondary_url || ""}
                onChange={(e) => setField("hero_cta_secondary_url", e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
          </div>
        </div>
      );
    }

    if (section === "home.features") {
      return (
        <div className="space-y-3">
          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Features Headline</span>
              <span className="text-xs text-slate-400">{charCount(draft.features_headline)}/120</span>
            </div>
            <input
              value={draft.features_headline || ""}
              onChange={(e) => setField("features_headline", e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Features Subheadline</span>
            <textarea
              value={draft.features_subheadline || ""}
              onChange={(e) => setField("features_subheadline", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Integrations (comma separated)</span>
            <input
              value={draft.integrations_list || ""}
              onChange={(e) => setField("integrations_list", e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>
      );
    }

    if (section === "home.demo") {
      return (
        <div className="space-y-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Demo Section Headline</span>
            <input
              value={draft.demo_section_headline || ""}
              onChange={(e) => setField("demo_section_headline", e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Demo Section Body</span>
            <textarea
              value={draft.demo_section_body || ""}
              onChange={(e) => setField("demo_section_body", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      );
    }

    if (section === "about.content") {
      return (
        <div className="space-y-3">
          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">About Headline</span>
              <span className="text-xs text-slate-400">{charCount(draft.about_headline)}/120</span>
            </div>
            <input
              value={draft.about_headline || ""}
              onChange={(e) => setField("about_headline", e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">About Body</span>
            <textarea
              value={draft.about_body || ""}
              onChange={(e) => setField("about_body", e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      );
    }

    if (section === "faq.items") {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">FAQ Items</p>
            <button
              type="button"
              onClick={addFaq}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            >
              + Add Item
            </button>
          </div>
          <div className="space-y-2">
            {faqItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropFaq(index)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all duration-200"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">⠿ FAQ #{index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                  >
                    Remove
                  </button>
                </div>
                <input
                  value={item.q}
                  onChange={(e) => updateFaq(index, "q", e.target.value)}
                  placeholder="Question"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                />
                <textarea
                  value={item.a}
                  onChange={(e) => updateFaq(index, "a", e.target.value)}
                  placeholder="Answer"
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (section === "demo.content") {
      return (
        <div className="space-y-3">
          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Demo Headline</span>
              <span className="text-xs text-slate-400">{charCount(draft.demo_page_headline)}/120</span>
            </div>
            <input
              value={draft.demo_page_headline || ""}
              onChange={(e) => setField("demo_page_headline", e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Demo Body</span>
            <textarea
              value={draft.demo_page_body || ""}
              onChange={(e) => setField("demo_page_body", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Hero Image Path</span>
          <input
            value={draft.hero_image || ""}
            onChange={(e) => setField("hero_image", e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void uploadImage(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative cursor-pointer rounded-xl border-2 border-dashed p-4 transition-colors ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
          }`}
        >
          {draft.hero_image ? (
            <img src={draft.hero_image} alt="Hero" className="w-full rounded-lg border border-slate-200 bg-white" />
          ) : (
            <div className="rounded-lg bg-white p-10 text-center text-sm text-slate-500">Drop image here or click to upload</div>
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/55 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-slate-900">Change Image</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void uploadImage(file);
              e.currentTarget.value = "";
            }}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5">Loading marketing settings...</div>;
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</div>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeMessage = messages[activeSection];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Marketing Site Editor</h1>
          <p className="text-sm text-slate-600">Visual content control for reservesit.com</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              hasUnsavedChanges ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500"}`} />
            {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
          </span>
          <a
            href="https://reservesit.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            🌐 View Live Site →
          </a>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl bg-slate-900 p-4 text-slate-100 shadow-lg">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pages</p>
            <div className="mt-2 space-y-2">
              {PAGE_GROUPS.map((group) => {
                const groupDirty = group.sections.some((section) => dirtyBySection[section.id]);
                return (
                  <div key={group.id} className="rounded-xl border border-slate-800 bg-slate-950/30">
                    <button
                      type="button"
                      onClick={() => togglePage(group.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span>{group.icon}</span>
                        <span>{group.label}</span>
                        {groupDirty ? <span className="h-2 w-2 rounded-full bg-amber-400" /> : null}
                      </span>
                      <span className="text-xs text-slate-400">{expandedPages[group.id] ? "▾" : "▸"}</span>
                    </button>

                    {expandedPages[group.id] ? (
                      <div className="border-t border-slate-800 px-2 pb-2 pt-1">
                        {group.sections.map((section) => {
                          const active = activeSection === section.id;
                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => setActiveSection(section.id)}
                              className={`mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                active
                                  ? "bg-blue-600 text-white"
                                  : "text-slate-300 hover:bg-slate-800"
                              }`}
                            >
                              <span>{section.label}</span>
                              {dirtyBySection[section.id] ? <span className="h-2 w-2 rounded-full bg-amber-300" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Media</p>
            <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/30">
              <button
                type="button"
                onClick={() => togglePage(MEDIA_GROUP.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span>{MEDIA_GROUP.icon}</span>
                  <span>{MEDIA_GROUP.label}</span>
                  {MEDIA_GROUP.sections.some((section) => dirtyBySection[section.id]) ? <span className="h-2 w-2 rounded-full bg-amber-400" /> : null}
                </span>
                <span className="text-xs text-slate-400">{expandedPages[MEDIA_GROUP.id] ? "▾" : "▸"}</span>
              </button>

              {expandedPages[MEDIA_GROUP.id] ? (
                <div className="border-t border-slate-800 px-2 pb-2 pt-1">
                  {MEDIA_GROUP.sections.map((section) => {
                    const active = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={`mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          active
                            ? "bg-blue-600 text-white"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <span>{section.label}</span>
                        {dirtyBySection[section.id] ? <span className="h-2 w-2 rounded-full bg-amber-300" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{activeSection.replace(".", " • ")}</p>
              <h2 className="text-xl font-semibold text-slate-900">{SECTION_TITLES[activeSection]}</h2>
              <p className="text-xs text-slate-500">Auto-save runs 2 seconds after edits.</p>
            </div>
            {dirtyBySection[activeSection] ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Unsaved
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Synced
              </span>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">{renderSectionPreview(activeSection)}</div>

          <div className="mt-4">{renderSectionFields(activeSection)}</div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => void saveSection(activeSection, "manual")}
              disabled={Boolean(saving[activeSection]) || uploadingImage}
              className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {saving[activeSection] ? "Saving..." : "💾 Save Changes"}
            </button>
            {activeMessage?.text ? (
              <p className={`mt-2 text-sm ${activeMessage.type === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                {activeMessage.text}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
