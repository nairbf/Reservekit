"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";

type TabKey = "home" | "about" | "faq" | "demo" | "images";
type MessageType = "success" | "error";

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

const TAB_OPTIONS: Array<{ id: TabKey; label: string }> = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "faq", label: "FAQ" },
  { id: "demo", label: "Demo Page" },
  { id: "images", label: "Images" },
];

const DEFAULT_FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "How is ReserveSit different from OpenTable?",
    a: "ReserveSit is a one-time license you own. No per-cover fees or monthly lock-in.",
  },
  {
    q: "Can I try ReserveSit before buying?",
    a: "Yes. The live demo at demo.reservesit.com is fully functional and resets nightly.",
  },
  {
    q: "What happens after purchase?",
    a: "Your hosted instance is provisioned and you receive onboarding details to go live quickly.",
  },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  hero_badge: "🚀 Now in production - restaurants are live",
  hero_headline: "The reservation platform you buy once and own.",
  hero_subheadline:
    "OpenTable and similar platforms start at $3,000-$3,600/year on their lowest plans - and go up from there. ReserveSit starts at a one-time $2,199 license.",
  hero_cta_primary_text: "See Pricing",
  hero_cta_primary_url: "/pricing",
  hero_cta_secondary_text: "Book a Demo Call",
  hero_cta_secondary_url: "/demo",
  hero_image: "/dashboard-preview.png",
  features_headline: "Features Built for Real Service",
  features_subheadline: "Everything your team needs to run reservations without subscription lock-in.",
  integrations_list: "📍 SpotOn, 🟩 Square, 🍞 Toast, 🍀 Clover, 💳 Stripe",
  demo_section_headline: "👀 See it in action",
  demo_section_body: "Explore a fully working demo instance with real data. No sign-up required.",
  about_headline: "Built by operators, for operators.",
  about_body:
    "ReserveSit was created to give independent restaurants the same technology as the big chains - without the recurring fees.",
  demo_page_headline: "Try ReserveSit right now",
  demo_page_body: "Our demo instance has real data and resets nightly. No sign-up required.",
  faq_items: JSON.stringify(DEFAULT_FAQ_ITEMS),
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

export default function MarketingEditorPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [faqItems, setFaqItems] = useState<FaqItem[]>(parseFaqItems(DEFAULT_SETTINGS.faq_items));
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: MessageType; text: string }>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  function setField(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setSectionMessage(section: string, type: MessageType, text: string) {
    setMessages((prev) => ({ ...prev, [section]: { type, text } }));
  }

  async function loadSettings() {
    setLoading(true);
    setLoadError("");

    try {
      const res = await fetch("/api/marketing-settings", { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load marketing settings");
      }

      const payload = (await res.json()) as { settings?: unknown };
      const saved = normalizeSettings(payload.settings);
      const merged = { ...DEFAULT_SETTINGS, ...saved };
      setDraft(merged);
      setFaqItems(parseFaqItems(merged.faq_items));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load marketing settings";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveSection(section: string, patch: Record<string, string>) {
    setSaving((prev) => ({ ...prev, [section]: true }));
    setSectionMessage(section, "success", "");

    try {
      const res = await fetch("/api/marketing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: patch }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to save changes");

      setDraft((prev) => ({ ...prev, ...patch }));
      setSectionMessage(section, "success", "Saved.");
      showToast("Saved marketing settings.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes";
      setSectionMessage(section, "error", message);
      showToast(message, "error");
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  }

  async function uploadImage(file: File) {
    setUploadingImage(true);
    setSectionMessage("images", "success", "");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/marketing-settings/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error || "Upload failed");

      setField("hero_image", payload.url);
      setSectionMessage("images", "success", "Image uploaded. Save to publish.");
      showToast("Image uploaded.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setSectionMessage("images", "error", message);
      showToast(message, "error");
    } finally {
      setUploadingImage(false);
    }
  }

  function updateFaq(index: number, field: "q" | "a", value: string) {
    setFaqItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function addFaq() {
    setFaqItems((prev) => [...prev, { id: `faq-${Date.now()}`, q: "", a: "" }]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Marketing Site Editor</h1>
          <p className="text-sm text-slate-600">Edit reservesit.com copy and assets without code changes.</p>
        </div>
        <a
          href="https://reservesit.com"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Open Marketing Site →
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "home" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Home Page Content</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hero Badge</span>
              <input
                value={draft.hero_badge || ""}
                onChange={(e) => setField("hero_badge", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hero Headline</span>
              <textarea
                value={draft.hero_headline || ""}
                onChange={(e) => setField("hero_headline", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hero Subheadline</span>
              <textarea
                value={draft.hero_subheadline || ""}
                onChange={(e) => setField("hero_subheadline", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary CTA Text</span>
              <input
                value={draft.hero_cta_primary_text || ""}
                onChange={(e) => setField("hero_cta_primary_text", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary CTA URL</span>
              <input
                value={draft.hero_cta_primary_url || ""}
                onChange={(e) => setField("hero_cta_primary_url", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secondary CTA Text</span>
              <input
                value={draft.hero_cta_secondary_text || ""}
                onChange={(e) => setField("hero_cta_secondary_text", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secondary CTA URL</span>
              <input
                value={draft.hero_cta_secondary_url || ""}
                onChange={(e) => setField("hero_cta_secondary_url", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Features Headline</span>
              <input
                value={draft.features_headline || ""}
                onChange={(e) => setField("features_headline", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Features Subheadline</span>
              <textarea
                value={draft.features_subheadline || ""}
                onChange={(e) => setField("features_subheadline", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Integrations (comma separated)</span>
              <input
                value={draft.integrations_list || ""}
                onChange={(e) => setField("integrations_list", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo Section Headline</span>
              <input
                value={draft.demo_section_headline || ""}
                onChange={(e) => setField("demo_section_headline", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo Section Body</span>
              <textarea
                value={draft.demo_section_body || ""}
                onChange={(e) => setField("demo_section_body", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void saveSection("home", {
                  hero_badge: draft.hero_badge || "",
                  hero_headline: draft.hero_headline || "",
                  hero_subheadline: draft.hero_subheadline || "",
                  hero_cta_primary_text: draft.hero_cta_primary_text || "",
                  hero_cta_primary_url: draft.hero_cta_primary_url || "",
                  hero_cta_secondary_text: draft.hero_cta_secondary_text || "",
                  hero_cta_secondary_url: draft.hero_cta_secondary_url || "",
                  features_headline: draft.features_headline || "",
                  features_subheadline: draft.features_subheadline || "",
                  integrations_list: draft.integrations_list || "",
                  demo_section_headline: draft.demo_section_headline || "",
                  demo_section_body: draft.demo_section_body || "",
                })
              }
              disabled={Boolean(saving.home)}
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving.home ? "Saving..." : "Save Home Content"}
            </button>
            {messages.home?.text ? (
              <p className={`text-sm ${messages.home.type === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                {messages.home.text}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "about" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">About Page Content</h2>
          <div className="mt-4 grid gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headline</span>
              <input
                value={draft.about_headline || ""}
                onChange={(e) => setField("about_headline", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Body</span>
              <textarea
                value={draft.about_body || ""}
                onChange={(e) => setField("about_body", e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void saveSection("about", {
                  about_headline: draft.about_headline || "",
                  about_body: draft.about_body || "",
                })
              }
              disabled={Boolean(saving.about)}
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving.about ? "Saving..." : "Save About Page"}
            </button>
            {messages.about?.text ? (
              <p className={`text-sm ${messages.about.type === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                {messages.about.text}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "faq" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">FAQ Items</h2>
            <button
              type="button"
              onClick={addFaq}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
            >
              + Add FAQ
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {faqItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropFaq(index)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FAQ #{index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                  >
                    Remove
                  </button>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question</span>
                  <input
                    value={item.q}
                    onChange={(e) => updateFaq(index, "q", e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="mt-2 block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Answer</span>
                  <textarea
                    value={item.a}
                    onChange={(e) => updateFaq(index, "a", e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">Drag to reorder.</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void saveSection("faq", {
                  faq_items: faqToJson(faqItems),
                })
              }
              disabled={Boolean(saving.faq)}
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving.faq ? "Saving..." : "Save FAQ"}
            </button>
            {messages.faq?.text ? (
              <p className={`text-sm ${messages.faq.type === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                {messages.faq.text}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "demo" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Demo Page Content</h2>
          <div className="mt-4 grid gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headline</span>
              <input
                value={draft.demo_page_headline || ""}
                onChange={(e) => setField("demo_page_headline", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Body</span>
              <textarea
                value={draft.demo_page_body || ""}
                onChange={(e) => setField("demo_page_body", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void saveSection("demo", {
                  demo_page_headline: draft.demo_page_headline || "",
                  demo_page_body: draft.demo_page_body || "",
                })
              }
              disabled={Boolean(saving.demo)}
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving.demo ? "Saving..." : "Save Demo Page"}
            </button>
            {messages.demo?.text ? (
              <p className={`text-sm ${messages.demo.type === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                {messages.demo.text}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "images" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Image Uploads</h2>
          <p className="mt-1 text-sm text-slate-600">Upload assets directly to the marketing site public folder.</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hero Image Path</span>
                <input
                  value={draft.hero_image || ""}
                  onChange={(e) => setField("hero_image", e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upload Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadImage(file);
                    e.currentTarget.value = "";
                  }}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  void saveSection("images", {
                    hero_image: draft.hero_image || "",
                  })
                }
                disabled={Boolean(saving.images) || uploadingImage}
                className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving.images ? "Saving..." : uploadingImage ? "Uploading..." : "Save Image Settings"}
              </button>

              {messages.images?.text ? (
                <p className={`text-sm ${messages.images.type === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                  {messages.images.text}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              {draft.hero_image ? (
                <img src={draft.hero_image} alt="Hero preview" className="mt-2 w-full rounded-lg border border-slate-200 bg-white" />
              ) : (
                <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  No hero image selected.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
