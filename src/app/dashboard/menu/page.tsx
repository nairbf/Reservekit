"use client";

import { useEffect, useMemo, useState } from "react";

type CategoryType = "starter" | "drink";

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
  type: CategoryType;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
}

interface UploadedMenuFile {
  id: string;
  label: string;
  filename: string;
  url: string;
  type: "pdf" | "image";
  order: number;
  uploadedAt: string;
}

interface PosSyncInfo {
  provider: string | null;
  connected: boolean;
  lastSync: string | null;
  locationName: string | null;
  error: string | null;
  counts: {
    menuItems: number;
    tables: number;
    businessHours: number;
  };
}

interface MenuFileGroup {
  key: string;
  label: string;
  files: UploadedMenuFile[];
  type: "pdf" | "image" | "mixed";
  latestUploadedAt: string;
  sortOrder: number;
}

function normalizeMenuLabel(label: string | null | undefined): string {
  const trimmed = String(label || "").trim();
  return trimmed || "Untitled";
}

function menuFileGroupKey(label: string | null | undefined): string {
  return normalizeMenuLabel(label).toLowerCase();
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
  const [menuFiles, setMenuFiles] = useState<UploadedMenuFile[]>([]);
  const [posSyncInfo, setPosSyncInfo] = useState<PosSyncInfo | null>(null);
  const [syncingPos, setSyncingPos] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadingMenuFile, setUploadingMenuFile] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>("starter");
  const [newItemByCategory, setNewItemByCategory] = useState<Record<number, {
    name: string;
    description: string;
    price: string;
    dietaryTags: string[];
    sortOrder: string;
  }>>({});

  async function load() {
    const [settingsRes, meRes, categoriesRes, menuFilesRes, posSyncRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/auth/me").catch(() => null),
      fetch("/api/menu/categories"),
      fetch("/api/menu/upload"),
      fetch("/api/pos/sync").catch(() => null),
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

    if (menuFilesRes.ok) {
      const payload = await menuFilesRes.json();
      setMenuFiles(Array.isArray(payload?.files) ? payload.files as UploadedMenuFile[] : []);
    } else {
      setMenuFiles([]);
    }

    if (posSyncRes && posSyncRes.ok) {
      const payload = (await posSyncRes.json().catch(() => null)) as PosSyncInfo | null;
      setPosSyncInfo(payload);
    } else {
      setPosSyncInfo(null);
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

  const starterCategories = useMemo(
    () => filtered.filter(category => category.type !== "drink"),
    [filtered],
  );
  const drinkCategories = useMemo(
    () => filtered.filter(category => category.type === "drink"),
    [filtered],
  );
  const groupedMenuFiles = useMemo(() => {
    const sortedFiles = [...menuFiles].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const groups = new Map<string, MenuFileGroup>();

    for (const file of sortedFiles) {
      const key = menuFileGroupKey(file.label);
      const displayLabel = normalizeMenuLabel(file.label);
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          key,
          label: displayLabel,
          files: [file],
          type: file.type,
          latestUploadedAt: file.uploadedAt,
          sortOrder: file.order ?? 0,
        });
        continue;
      }

      const nextType: MenuFileGroup["type"] =
        existing.type === file.type ? existing.type : "mixed";
      const nextLatest =
        new Date(file.uploadedAt).getTime() > new Date(existing.latestUploadedAt).getTime()
          ? file.uploadedAt
          : existing.latestUploadedAt;

      groups.set(key, {
        ...existing,
        files: [...existing.files, file],
        type: nextType,
        latestUploadedAt: nextLatest,
        sortOrder: Math.min(existing.sortOrder, file.order ?? 0),
      });
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        files: [...group.files].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menuFiles]);

  async function uploadMenuFile() {
    if (!uploadFile) {
      setMessage("Choose a PDF or image file first.");
      return;
    }

    const form = new FormData();
    form.append("file", uploadFile);
    form.append("label", uploadLabel.trim() || "Menu");

    setUploadingMenuFile(true);
    setMessage("");
    const res = await fetch("/api/menu/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    setUploadingMenuFile(false);

    if (!res.ok) {
      setMessage(data.error || "Could not upload menu file.");
      return;
    }

    setUploadFile(null);
    setUploadLabel("");
    setMessage("Menu file uploaded.");
    await load();
  }

  async function saveMenuFileOrder(next: UploadedMenuFile[]) {
    const payload = next.map((file, index) => ({
      id: file.id,
      label: file.label,
      order: index,
    }));
    const res = await fetch("/api/menu/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payload }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Could not reorder menu files.");
      return;
    }
    await load();
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  async function moveMenuGroup(groupIndex: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? groupIndex - 1 : groupIndex + 1;
    if (nextIndex < 0 || nextIndex >= groupedMenuFiles.length) return;

    const nextGroups = [...groupedMenuFiles];
    const [entry] = nextGroups.splice(groupIndex, 1);
    nextGroups.splice(nextIndex, 0, entry);

    const next = nextGroups.flatMap((group) =>
      group.files.map((file) => ({ ...file, label: group.label })),
    );
    setMenuFiles(next);
    await saveMenuFileOrder(next);
  }

  async function renameMenuGroup(group: MenuFileGroup) {
    const nextLabel = prompt("Menu label:", group.label)?.trim();
    if (!nextLabel) return;

    const next = menuFiles.map((entry) =>
      menuFileGroupKey(entry.label) === group.key ? { ...entry, label: nextLabel } : entry,
    );
    setMenuFiles(next);
    setExpandedGroups((prev) => {
      const updated = new Set(prev);
      if (updated.has(group.key)) {
        updated.delete(group.key);
        updated.add(menuFileGroupKey(nextLabel));
      }
      return updated;
    });
    await saveMenuFileOrder(next);
  }

  async function deleteAllMenuFilesInGroup(group: MenuFileGroup) {
    if (!confirm(`Delete all ${group.files.length} file(s) in "${group.label}"?`)) return;

    const results = await Promise.all(
      group.files.map((file) =>
        fetch("/api/menu/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: file.id }),
        }),
      ),
    );

    const failed = results.find((result) => !result.ok);
    if (failed) {
      const data = await failed.json().catch(() => ({}));
      setMessage(data.error || "Could not delete all files in that menu group.");
      return;
    }

    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.delete(group.key);
      return next;
    });
    setMessage(`Deleted all files in "${group.label}".`);
    await load();
  }

  async function deleteMenuFile(file: UploadedMenuFile) {
    if (!confirm(`Delete "${file.filename}"?`)) return;
    const res = await fetch("/api/menu/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: file.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "Could not delete menu file.");
      return;
    }
    setMessage("Menu file deleted.");
    await load();
  }

  async function syncPosMenuNow() {
    const provider = posSyncInfo?.provider;
    if (!provider) return;
    setSyncingPos(true);
    setMessage("");
    try {
      const response = await fetch("/api/pos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "POS sync failed.");
      setMessage(`Synced ${provider} data.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "POS sync failed.");
    } finally {
      setSyncingPos(false);
    }
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCategoryName.trim(),
        type: newCategoryType,
        sortOrder: categories.length + 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not create category.");
      return;
    }
    setNewCategoryName("");
    setNewCategoryType("starter");
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

  function renderCategoryCard(category: MenuCategory) {
    const newItem = getNewItemState(category.id);
    return (
      <div key={category.id} className="bg-white rounded-xl shadow">
        <div className="p-4 border-b flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => shiftSort("category", category.id, category.sortOrder, "up")}
              className="h-11 w-11 rounded border border-gray-200 text-xs"
            >
              ↑
            </button>
            <button
              onClick={() => shiftSort("category", category.id, category.sortOrder, "down")}
              className="h-11 w-11 rounded border border-gray-200 text-xs"
            >
              ↓
            </button>
            <input
              value={category.name}
              onChange={e => setCategories(prev => prev.map(c => (c.id === category.id ? { ...c, name: e.target.value } : c)))}
              onBlur={e => saveCategory(category, { name: e.target.value })}
              className="h-11 border rounded px-3 font-semibold"
            />
            <select
              value={category.type || "starter"}
              onChange={e => saveCategory(category, { type: e.target.value === "drink" ? "drink" : "starter" })}
              className="h-11 border rounded px-2 text-sm"
            >
              <option value="starter">Starter</option>
              <option value="drink">Drink</option>
            </select>
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
              className="h-11 px-3 rounded border border-red-200 text-red-700 text-sm"
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
                    className="h-11 w-11 rounded border border-gray-200 text-xs"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => shiftSort("item", item.id, item.sortOrder, "down", { categoryId: item.categoryId })}
                    className="h-11 w-11 rounded border border-gray-200 text-xs"
                  >
                    ↓
                  </button>
                  <button onClick={() => editItem(item)} className="h-11 px-3 rounded border border-gray-200 text-xs">Edit</button>
                  <button onClick={() => deleteItem(item)} className="h-11 px-3 rounded border border-red-200 text-red-700 text-xs">Delete</button>
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
            className="h-11 border rounded px-3"
          />
          <input
            value={newItem.description}
            onChange={e => setNewItemState(category.id, { description: e.target.value })}
            placeholder="Description"
            className="h-11 border rounded px-3"
          />
          <input
            value={newItem.price}
            onChange={e => setNewItemState(category.id, { price: e.target.value })}
            placeholder="Price (USD)"
            className="h-11 border rounded px-3"
          />
          <input
            value={newItem.sortOrder}
            onChange={e => setNewItemState(category.id, { sortOrder: e.target.value })}
            placeholder="Sort"
            className="h-11 border rounded px-3"
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
            className="h-11 px-3 rounded bg-blue-600 text-white text-sm font-medium sm:col-span-2 lg:col-span-6"
          >
            Add Item
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading menu...
      </div>
    );
  }

  const posProviderLabel = posSyncInfo?.provider
    ? `${posSyncInfo.provider.charAt(0).toUpperCase()}${posSyncInfo.provider.slice(1)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menu Manager</h1>
          <p className="text-sm text-gray-500">Upload real menu files, and optionally maintain a digital menu builder for pre-ordering.</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search menu items"
          className="h-11 border rounded px-3 w-full sm:w-64"
        />
      </div>

      <section className="bg-white rounded-xl shadow p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Menu Files</h2>
            <p className="text-sm text-gray-500">Upload PDFs or photos exactly as your printed menus appear.</p>
          </div>
          <a href="/menu" target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline">
            Preview Public Menu →
          </a>
        </div>

        {posSyncInfo?.provider && posSyncInfo.connected ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                Synced from {posProviderLabel} ({posSyncInfo.counts.menuItems} items)
              </p>
              <button
                type="button"
                onClick={syncPosMenuNow}
                disabled={syncingPos}
                className="h-9 rounded border border-blue-300 px-3 text-xs font-medium text-blue-800 disabled:opacity-70"
              >
                {syncingPos ? "Syncing..." : "Sync Now"}
              </button>
            </div>
            <p className="mt-1 text-xs text-blue-700">
              Last updated: {posSyncInfo.lastSync ? new Date(posSyncInfo.lastSync).toLocaleString() : "Never"}
            </p>
          </div>
        ) : null}

        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input
            value={uploadLabel}
            onChange={(event) => setUploadLabel(event.target.value)}
            placeholder="Label (e.g. Dinner Menu)"
            className="h-11 border rounded px-3"
          />
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            className="h-11 border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={uploadMenuFile}
            disabled={uploadingMenuFile}
            className="h-11 px-4 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
          >
            {uploadingMenuFile ? "Uploading..." : "Upload Menu"}
          </button>
        </div>

        {menuFiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            No menu files uploaded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {groupedMenuFiles.map((group, index) => {
              const expanded = expandedGroups.has(group.key);
              const typeLabel = group.type === "mixed" ? "MIXED" : group.type.toUpperCase();
              const fileCountLabel = `${group.files.length} file${group.files.length === 1 ? "" : "s"}`;
              return (
                <div key={group.key} className="rounded-lg border border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full px-3 pt-3 text-left"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{group.label}</div>
                        <div className="text-xs text-gray-500">
                          Last updated: {new Date(group.latestUploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          {fileCountLabel}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            group.type === "pdf"
                              ? "bg-red-100 text-red-700"
                              : group.type === "image"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {typeLabel}
                        </span>
                        <span className="text-sm text-gray-500">{expanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2 px-3 pb-3">
                    <button
                      onClick={() => moveMenuGroup(index, "up")}
                      disabled={index === 0}
                      className="h-11 px-3 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveMenuGroup(index, "down")}
                      disabled={index === groupedMenuFiles.length - 1}
                      className="h-11 px-3 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => renameMenuGroup(group)}
                      className="h-11 px-3 rounded border border-gray-200 text-xs"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => deleteAllMenuFilesInGroup(group)}
                      className="h-11 px-3 rounded border border-red-200 text-red-700 text-xs"
                    >
                      Delete All
                    </button>
                  </div>

                  <div
                    className={`grid transition-all duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-gray-200 px-3 pb-3 pt-2 space-y-2">
                        {group.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {file.type === "image" ? (
                                <img
                                  src={file.url}
                                  alt={file.filename}
                                  className="h-12 w-12 rounded object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
                                  PDF
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{file.filename}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(file.uploadedAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="h-10 px-3 rounded border border-gray-200 text-xs inline-flex items-center"
                              >
                                Open
                              </a>
                              <button
                                onClick={() => deleteMenuFile(file)}
                                className="h-10 px-3 rounded border border-red-200 text-red-700 text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {licensed === false ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Digital Menu Builder is part of the Express Dining add-on. Upload-based menu files above still work for public menu display.
        </div>
      ) : null}

      {licensed !== false && !expressEnabled ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Express Dining is off. Enable it in Settings to let guests pre-order from the Digital Menu Builder.
        </div>
      ) : null}

      {licensed !== false ? (
        <>
          <section className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold">Digital Menu Builder</h2>
              <span className="text-xs text-gray-500">For Express Dining pre-orders</span>
            </div>
            <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2">
              <input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="h-11 border rounded px-3"
              />
              <select
                value={newCategoryType}
                onChange={e => setNewCategoryType((e.target.value === "drink" ? "drink" : "starter"))}
                className="h-11 border rounded px-3"
              >
                <option value="starter">Starter section</option>
                <option value="drink">Drink section</option>
              </select>
              <button onClick={createCategory} className="h-11 px-4 rounded bg-blue-600 text-white text-sm font-medium">Add Category</button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍽</span>
              <h2 className="text-lg font-bold">Starters & Appetizers</h2>
            </div>
            {starterCategories.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">No starter categories yet.</div>
            ) : (
              starterCategories.map(renderCategoryCard)
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥂</span>
              <h2 className="text-lg font-bold">Drinks & Cocktails</h2>
            </div>
            {drinkCategories.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">No drink categories yet.</div>
            ) : (
              drinkCategories.map(renderCategoryCard)
            )}
          </section>
        </>
      ) : null}

      {message && (
        <div className="text-sm text-gray-700 bg-white rounded-lg border px-3 py-2">{message}</div>
      )}
    </div>
  );
}
