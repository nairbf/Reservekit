"use client";

import { useEffect, useMemo, useState } from "react";

interface MenuItem {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: number;
  dietaryTags: string | null;
  sortOrder: number;
  isAvailable: boolean;
}

interface MenuCategory {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
}

function formatCents(cents: number): string {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

function toDollars(cents: number): string {
  return (Math.max(0, Math.trunc(cents)) / 100).toFixed(2);
}

function normalizeTags(tags: string[]): string {
  return tags.filter(Boolean).join(",");
}

const TAG_OPTIONS = ["GF", "V", "VG", "DF", "N"];

export default function MenuPage() {
  const [loading, setLoading] = useState(true);
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [expressEnabled, setExpressEnabled] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemByCategory, setNewItemByCategory] = useState<Record<number, {
    name: string;
    description: string;
    price: string;
    dietaryTags: string[];
    sortOrder: string;
  }>>({});

  async function load() {
    const [settingsRes, meRes, categoriesRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/auth/me").catch(() => null),
      fetch("/api/menu/categories"),
    ]);

    const settings = await settingsRes.json();
    const me = meRes && meRes.ok ? await meRes.json() : null;
    const key = String(settings.license_expressdining || "").toUpperCase();
    const hasKey = /^RS-XDN-[A-Z0-9]{8}$/.test(key);
    const isAdmin = me?.role === "admin" || me?.role === "superadmin";

    setLicensed(hasKey || isAdmin);
    setExpressEnabled(settings.expressDiningEnabled === "true");

    if (categoriesRes.ok) {
      const list = await categoriesRes.json();
      setCategories(Array.isArray(list) ? list : []);
    } else {
      setCategories([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map(category => ({
        ...category,
        items: category.items.filter(item =>
          `${item.name} ${item.description || ""} ${item.dietaryTags || ""}`.toLowerCase().includes(q),
        ),
      }))
      .filter(category => category.name.toLowerCase().includes(q) || category.items.length > 0);
  }, [categories, search]);

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim(), sortOrder: categories.length + 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not create category.");
      return;
    }
    setNewCategoryName("");
    setMessage("Category created.");
    await load();
  }

  async function saveCategory(category: MenuCategory, patch: Partial<MenuCategory>) {
    const res = await fetch(`/api/menu/categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "Could not update category.");
      return;
    }
    await load();
  }

  async function deleteCategory(category: MenuCategory) {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    const res = await fetch(`/api/menu/categories/${category.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete category.");
      return;
    }
    await load();
  }

  function getNewItemState(categoryId: number) {
    return newItemByCategory[categoryId] || {
      name: "",
      description: "",
      price: "",
      dietaryTags: [],
      sortOrder: "0",
    };
  }

  function setNewItemState(categoryId: number, patch: Partial<ReturnType<typeof getNewItemState>>) {
    setNewItemByCategory(prev => ({
      ...prev,
      [categoryId]: {
        ...getNewItemState(categoryId),
        ...patch,
      },
    }));
  }

  async function createItem(categoryId: number) {
    const state = getNewItemState(categoryId);
    if (!state.name.trim() || !state.price.trim()) {
      setMessage("Item name and price are required.");
      return;
    }
    const res = await fetch("/api/menu/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        name: state.name.trim(),
        description: state.description.trim() || null,
        price: state.price,
        dietaryTags: normalizeTags(state.dietaryTags),
        sortOrder: Number(state.sortOrder || "0"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not create item.");
      return;
    }
    setNewItemState(categoryId, { name: "", description: "", price: "", dietaryTags: [], sortOrder: "0" });
    await load();
  }

  async function toggleAvailability(item: MenuItem, available: boolean) {
    await fetch(`/api/menu/items/${item.id}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available }),
    });
    await load();
  }

  async function editItem(item: MenuItem) {
    const name = prompt("Item name:", item.name);
    if (!name) return;
    const description = prompt("Description:", item.description || "") || "";
    const price = prompt("Price (USD):", toDollars(item.price));
    if (!price) return;
    const dietaryTags = prompt("Dietary tags (comma-separated: GF,V,VG,DF,N):", item.dietaryTags || "") || "";
    const res = await fetch(`/api/menu/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, price, dietaryTags }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not update item.");
      return;
    }
    await load();
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const res = await fetch(`/api/menu/items/${item.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete item.");
      return;
    }
    await load();
  }

  async function shiftSort(
    type: "category" | "item",
    id: number,
    currentSortOrder: number,
    direction: "up" | "down",
    extra?: { categoryId?: number },
  ) {
    const delta = direction === "up" ? -1 : 1;
    const nextSort = currentSortOrder + delta;
    if (nextSort < 0) return;
    const url = type === "category" ? `/api/menu/categories/${id}` : `/api/menu/items/${id}`;
    const payload = type === "category"
      ? { sortOrder: nextSort }
      : { sortOrder: nextSort, categoryId: extra?.categoryId };
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading menu...
      </div>
    );
  }

  if (licensed === false) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Menu</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-600 mb-4">Express Dining is a paid add-on.</p>
          <a href="/#pricing" className="inline-flex items-center h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">Upgrade to Unlock</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menu Manager</h1>
          <p className="text-sm text-gray-500">Build categories and items for guest pre-orders.</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search menu items"
          className="h-11 border rounded px-3 w-full sm:w-64"
        />
      </div>

      {!expressEnabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Express Dining is off. Enable it in Settings to let guests pre-order.
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            placeholder="New category name"
            className="h-11 border rounded px-3 flex-1 min-w-[220px]"
          />
          <button onClick={createCategory} className="h-11 px-4 rounded bg-blue-600 text-white text-sm font-medium">Add Category</button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map(category => {
          const newItem = getNewItemState(category.id);
          return (
            <div key={category.id} className="bg-white rounded-xl shadow">
              <div className="p-4 border-b flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => shiftSort("category", category.id, category.sortOrder, "up")}
                    className="h-8 w-8 rounded border border-gray-200 text-xs"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => shiftSort("category", category.id, category.sortOrder, "down")}
                    className="h-8 w-8 rounded border border-gray-200 text-xs"
                  >
                    ↓
                  </button>
                  <input
                    value={category.name}
                    onChange={e => setCategories(prev => prev.map(c => (c.id === category.id ? { ...c, name: e.target.value } : c)))}
                    onBlur={e => saveCategory(category, { name: e.target.value })}
                    className="h-10 border rounded px-3 font-semibold"
                  />
                  <span className="text-xs text-gray-500">Sort: {category.sortOrder}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={category.isActive}
                      onChange={e => saveCategory(category, { isActive: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Active
                  </label>
                  <button
                    onClick={() => deleteCategory(category)}
                    className="h-10 px-3 rounded border border-red-200 text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {category.items.length === 0 && <p className="text-sm text-gray-500">No items yet.</p>}
                {category.items.map(item => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}
                        <div className="text-sm mt-1">{formatCents(item.price)}</div>
                        {item.dietaryTags && <div className="text-xs text-gray-500 mt-1">Tags: {item.dietaryTags}</div>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={item.isAvailable}
                            onChange={e => toggleAvailability(item, e.target.checked)}
                            className="h-4 w-4"
                          />
                          {item.isAvailable ? "Available" : "86'd"}
                        </label>
                        <button
                          onClick={() => shiftSort("item", item.id, item.sortOrder, "up", { categoryId: item.categoryId })}
                          className="h-8 w-8 rounded border border-gray-200 text-xs"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => shiftSort("item", item.id, item.sortOrder, "down", { categoryId: item.categoryId })}
                          className="h-8 w-8 rounded border border-gray-200 text-xs"
                        >
                          ↓
                        </button>
                        <button onClick={() => editItem(item)} className="h-9 px-3 rounded border border-gray-200 text-xs">Edit</button>
                        <button onClick={() => deleteItem(item)} className="h-9 px-3 rounded border border-red-200 text-red-700 text-xs">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t bg-gray-50 grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
                <input
                  value={newItem.name}
                  onChange={e => setNewItemState(category.id, { name: e.target.value })}
                  placeholder="Item name"
                  className="h-10 border rounded px-3"
                />
                <input
                  value={newItem.description}
                  onChange={e => setNewItemState(category.id, { description: e.target.value })}
                  placeholder="Description"
                  className="h-10 border rounded px-3"
                />
                <input
                  value={newItem.price}
                  onChange={e => setNewItemState(category.id, { price: e.target.value })}
                  placeholder="Price (USD)"
                  className="h-10 border rounded px-3"
                />
                <input
                  value={newItem.sortOrder}
                  onChange={e => setNewItemState(category.id, { sortOrder: e.target.value })}
                  placeholder="Sort"
                  className="h-10 border rounded px-3"
                />
                <div className="lg:col-span-2 flex flex-wrap items-center gap-2">
                  {TAG_OPTIONS.map(tag => (
                    <label key={tag} className="text-xs inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={newItem.dietaryTags.includes(tag)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...newItem.dietaryTags, tag]
                            : newItem.dietaryTags.filter(v => v !== tag);
                          setNewItemState(category.id, { dietaryTags: next });
                        }}
                        className="h-4 w-4"
                      />
                      {tag}
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => createItem(category.id)}
                  className="h-10 px-3 rounded bg-blue-600 text-white text-sm font-medium sm:col-span-2 lg:col-span-6"
                >
                  Add Item
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            No categories found.
          </div>
        )}
      </div>

      {message && (
        <div className="text-sm text-gray-700 bg-white rounded-lg border px-3 py-2">{message}</div>
      )}
    </div>
  );
}

