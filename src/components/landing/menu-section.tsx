"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface MenuItemView {
  id: number;
  name: string;
  description: string | null;
  price: number;
}

interface MenuCategoryView {
  id: number;
  name: string;
  items: MenuItemView[];
}

interface MenuFileView {
  id: string;
  label: string;
  type: "pdf" | "image";
  url: string;
  uploadedAt: string;
}

interface MenuGroup {
  label: string;
  count: number;
  type: "pdf" | "image";
  uploadedAt: string;
}

interface MenuSectionProps {
  categories: MenuCategoryView[];
  menuFiles: MenuFileView[];
  accentColor: string;
  showPreview?: boolean;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function groupMenuFiles(menuFiles: MenuFileView[]): MenuGroup[] {
  const groups = new Map<string, { label: string; count: number; type: "pdf" | "image"; uploadedAt: string; firstIndex: number }>();

  menuFiles.forEach((file, index) => {
    const displayLabel = file.label.trim() || "Menu";
    const key = normalizeLabel(displayLabel);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        label: displayLabel,
        count: 1,
        type: file.type,
        uploadedAt: file.uploadedAt,
        firstIndex: index,
      });
      return;
    }

    existing.count += 1;
    if (new Date(file.uploadedAt).getTime() > new Date(existing.uploadedAt).getTime()) {
      existing.uploadedAt = file.uploadedAt;
    }
  });

  return Array.from(groups.values())
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map(({ label, count, type, uploadedAt }) => ({ label, count, type, uploadedAt }));
}

export function MenuSection({ categories, menuFiles, accentColor, showPreview = true }: MenuSectionProps) {
  const usingUploads = menuFiles.length > 0;
  const menuGroups = useMemo(() => groupMenuFiles(menuFiles), [menuFiles]);

  const firstCategory = categories[0]?.id ?? null;
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(firstCategory);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? categories[0],
    [activeCategoryId, categories],
  );

  if (!usingUploads && !activeCategory) return null;

  return (
    <section id="menu" className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">What We're Serving</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 font-serif">Our Menu</h2>
        </div>
        <Link href="/menu" className="text-sm font-medium text-gray-700 hover:text-gray-900">
          View Full Menu →
        </Link>
      </div>

      {!showPreview ? (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">Our latest menus are available on the full menu page.</p>
          <Link
            href="/menu"
            className="mt-3 inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-white"
            style={{ backgroundColor: accentColor }}
          >
            View Full Menu
          </Link>
        </div>
      ) : usingUploads ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menuGroups.slice(0, 6).map((group) => (
            <article key={group.label.toLowerCase()} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{group.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${group.count > 1 ? "bg-emerald-100 text-emerald-700" : group.type === "pdf" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                  {group.count > 1 ? `${group.count} pages` : group.type.toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Updated {formatDate(group.uploadedAt)}</p>
              <div className="mt-4">
                <Link
                  href="/menu"
                  className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  View Menu
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = category.id === activeCategory?.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategoryId(category.id)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-all ${active ? "text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}
                  style={active ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                >
                  {category.name}
                </button>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4">
            {activeCategory?.items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
                    {item.description ? <p className="mt-1 text-sm text-gray-600">{item.description}</p> : null}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{formatMoney(item.price)}</div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
