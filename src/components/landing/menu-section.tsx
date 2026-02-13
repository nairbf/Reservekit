"use client";

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

interface MenuSectionProps {
  categories: MenuCategoryView[];
  accentColor: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function MenuSection({ categories, accentColor }: MenuSectionProps) {
  const first = categories[0]?.id ?? null;
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(first);

  const activeCategory = useMemo(
    () => categories.find(category => category.id === activeCategoryId) ?? categories[0],
    [activeCategoryId, categories],
  );

  if (!activeCategory) return null;

  return (
    <section id="menu" className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">What We're Serving</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 font-serif">Our Menu</h2>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        {categories.map(category => {
          const active = category.id === activeCategory.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategoryId(category.id)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${active ? "text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}
              style={active ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4">
        {activeCategory.items.map(item => (
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
    </section>
  );
}
