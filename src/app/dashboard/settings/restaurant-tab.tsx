"use client";

import { useEffect, useMemo, useState } from "react";
import LandingBuilder from "@/components/landing-builder";
import type { SettingsTabProps } from "./page";

function normalizeSlug(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function RestaurantTab({ settings, setField, savePartial, saving }: SettingsTabProps) {
  const [slugInput, setSlugInput] = useState(settings.slug || "");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugMessage, setSlugMessage] = useState("");

  useEffect(() => {
    setSlugInput(settings.slug || "");
  }, [settings.slug]);

  const slugError = useMemo(() => {
    const value = String(slugInput || "").trim();
    if (!value) return "Slug is required.";
    if (!SLUG_PATTERN.test(value)) return "Use lowercase letters, numbers, and hyphens only.";
    return "";
  }, [slugInput]);

  const previewHost = typeof window !== "undefined" ? window.location.host : "reservesit.com";
  const previewSlug = String(slugInput || "").trim() || "your-restaurant";

  async function saveSlug() {
    const nextSlug = normalizeSlug(slugInput);
    if (!nextSlug || !SLUG_PATTERN.test(nextSlug)) {
      setSlugMessage("Use lowercase letters, numbers, and hyphens only.");
      return;
    }
    setSlugSaving(true);
    setSlugMessage("");
    try {
      await savePartial({ slug: nextSlug });
      setField("slug", nextSlug);
      setSlugInput(nextSlug);
      setSlugMessage("Slug saved.");
    } catch (error) {
      setSlugMessage(error instanceof Error ? error.message : "Failed to save slug.");
    } finally {
      setSlugSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h3 className="text-base font-semibold text-gray-900">URL Slug</h3>
        <p className="mt-1 text-sm text-gray-600">
          Used in your booking URL: reservesit.com/reserve/{"{"}slug{"}"}
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-800">Restaurant Slug</label>
            <input
              value={slugInput}
              onChange={(event) => {
                const next = normalizeSlug(event.target.value);
                setSlugInput(next);
                setField("slug", next);
                setSlugMessage("");
              }}
              placeholder="reef"
              className={`h-11 w-full rounded-lg border px-3 text-sm ${slugError ? "border-red-300" : "border-gray-200"}`}
            />
            {slugError ? <p className="mt-1 text-xs text-red-600">{slugError}</p> : null}
            <p className="mt-1 text-xs text-gray-500">
              Preview: {previewHost}/reserve/{previewSlug}
            </p>
          </div>
          <button
            type="button"
            onClick={saveSlug}
            disabled={saving || slugSaving || Boolean(slugError)}
            className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 disabled:opacity-60 sm:w-auto"
          >
            {slugSaving ? "Saving..." : "Save Slug"}
          </button>
        </div>
        {slugMessage ? (
          <p className={`mt-2 text-sm ${slugMessage === "Slug saved." ? "text-green-700" : "text-red-600"}`}>{slugMessage}</p>
        ) : null}
      </section>

      <LandingBuilder settings={settings} onSavePartial={savePartial} />
    </div>
  );
}
