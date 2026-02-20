"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Save, X } from "lucide-react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

type CategoryType = "starter" | "main" | "side" | "dessert" | "drink" | "other";

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
const CATEGORY_TYPE_OPTIONS: Array<{ value: CategoryType; label: string }> = [
  { value: "starter", label: "Starters & Apps" },
  { value: "main", label: "Mains & Entrees" },
  { value: "side", label: "Sides" },
  { value: "dessert", label: "Desserts" },
  { value: "drink", label: "Drinks & Cocktails" },
  { value: "other", label: "Other" },
];
const CATEGORY_TYPE_ORDER: CategoryType[] = ["starter", "main", "side", "dessert", "drink", "other"];
const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  starter: "🍽 Starters & Appetizers",
  main: "🥩 Mains & Entrees",
  side: "🥗 Sides",
  dessert: "🍰 Desserts",
  drink: "🥂 Drinks & Cocktails",
  other: "📋 Other",
};

interface EditingItemState {
  name: string;
  description: string;
  price: string;
  dietaryTags: string[];
}

function parseDietaryTags(value: string | null | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeCategoryType(value: string | null | undefined): CategoryType {
  const normalized = String(value || "").toLowerCase();
  if (
    normalized === "starter"
    || normalized === "main"
    || normalized === "side"
    || normalized === "dessert"
    || normalized === "drink"
    || normalized === "other"
  ) {
    return normalized;
  }
  return "other";
}

export default function MenuPage() {
  const canManageMenu = useHasPermission("manage_menu");
  const [loading, setLoading] = useState(true);
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [expressEnabled, setExpressEnabled] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuFiles, setMenuFiles] = useState<UploadedMenuFile[]>([]);
  const [posSyncInfo, setPosSyncInfo] = useState<PosSyncInfo | null>(null);
  const [syncingPos, setSyncingPos] = useState(false);
  const [savingExpress, setSavingExpress] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [renamingGroupKey, setRenamingGroupKey] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState("");
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
  }>>({});
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<number>>(new Set());
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);

  if (!canManageMenu) return <AccessDenied />;

  async function load() {
    const [settingsRes, meRes, categoriesRes, menuFilesRes, posSyncRes] = await Promise.all([
      fetch("/api/settings/public"),
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

  const groupedByType = useMemo(() => {
    return CATEGORY_TYPE_ORDER
      .map((type) => ({
        type,
        label: CATEGORY_TYPE_LABELS[type],
        categories: filtered.filter((category) => normalizeCategoryType(category.type) === type),
      }))
      .filter((group) => group.categories.length > 0);
  }, [filtered]);
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

  function startRenameMenuGroup(group: MenuFileGroup) {
    setRenamingGroupKey(group.key);
    setRenameGroupValue(group.label);
  }

  function cancelRenameMenuGroup() {
    setRenamingGroupKey(null);
    setRenameGroupValue("");
  }

  async function saveMenuGroupRename(group: MenuFileGroup) {
    const nextLabel = renameGroupValue.trim();
    if (!nextLabel) {
      setMessage("Menu label cannot be empty.");
      return;
    }
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
    cancelRenameMenuGroup();
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

  async function toggleExpressDining() {
    const next = !expressEnabled;
    const previous = expressEnabled;
    setExpressEnabled(next);
    setSavingExpress(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expressDiningEnabled: next ? "true" : "false" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Could not update Express Dining.");
      }
      setMessage(next ? "Express Dining enabled." : "Express Dining disabled.");
    } catch (error) {
      setExpressEnabled(previous);
      setMessage(error instanceof Error ? error.message : "Could not update Express Dining.");
    } finally {
      setSavingExpress(false);
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
        sortOrder: Math.max(
          0,
          ...(categories.find((category) => category.id === categoryId)?.items.map((item) => item.sortOrder) ?? [0]),
        ) + 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not create item.");
      return;
    }
    setNewItemState(categoryId, { name: "", description: "", price: "", dietaryTags: [] });
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

  function startEditItem(item: MenuItem) {
    setEditingItemId(item.id);
    setEditingItem({
      name: item.name,
      description: item.description || "",
      price: toDollars(item.price),
      dietaryTags: parseDietaryTags(item.dietaryTags),
    });
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditingItem(null);
  }

  async function saveEditedItem(item: MenuItem) {
    if (!editingItem) return;
    if (!editingItem.name.trim() || !editingItem.price.trim()) {
      setMessage("Item name and price are required.");
      return;
    }
    const res = await fetch(`/api/menu/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingItem.name.trim(),
        description: editingItem.description.trim() || null,
        price: editingItem.price,
        dietaryTags: normalizeTags(editingItem.dietaryTags),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not update item.");
      return;
    }
    cancelEditItem();
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

  function toggleCategoryCollapse(categoryId: number) {
    setCollapsedCategoryIds((previous) => {
      const next = new Set(previous);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function toggleTagValue(tags: string[], tag: string): string[] {
    return tags.includes(tag) ? tags.filter((value) => value !== tag) : [...tags, tag];
  }

  function renderCategoryCard(category: MenuCategory) {
    const newItem = getNewItemState(category.id);
    const categoryType = normalizeCategoryType(category.type);
    const collapsed = collapsedCategoryIds.has(category.id);
    const sortedItems = [...category.items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    return (
      <div key={category.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => toggleCategoryCollapse(category.id)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                aria-label={collapsed ? "Expand category" : "Collapse category"}
              >
                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <button
                onClick={() => shiftSort("category", category.id, category.sortOrder, "up")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                aria-label="Move category up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => shiftSort("category", category.id, category.sortOrder, "down")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                aria-label="Move category down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <input
                value={category.name}
                onChange={(event) => setCategories((previous) => previous.map((entry) => (entry.id === category.id ? { ...entry, name: event.target.value } : entry)))}
                onBlur={(event) => saveCategory(category, { name: event.target.value })}
                className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 text-base font-semibold text-slate-900"
              />
              <select
                value={categoryType}
                onChange={(event) => saveCategory(category, { type: normalizeCategoryType(event.target.value) })}
                className="h-10 rounded-lg border border-slate-200 px-2 text-sm"
              >
                {CATEGORY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={category.isActive}
                  onChange={(event) => saveCategory(category, { isActive: event.target.checked })}
                  className="h-4 w-4"
                />
                Active
              </label>
              <button
                onClick={() => deleteCategory(category)}
                className="h-10 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="p-4">
              {sortedItems.length === 0 ? (
                <p className="text-sm text-slate-500">No items yet.</p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden md:grid md:grid-cols-[minmax(160px,1.2fr)_minmax(220px,2fr)_100px_150px_95px_220px] md:gap-2 md:px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Name</span>
                    <span>Description</span>
                    <span>Price</span>
                    <span>Tags</span>
                    <span>Available</span>
                    <span>Actions</span>
                  </div>
                  {sortedItems.map((item) => {
                    const tags = parseDietaryTags(item.dietaryTags);
                    const isEditing = editingItemId === item.id;
                    if (isEditing && editingItem) {
                      return (
                        <div key={item.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                            <input
                              value={editingItem.name}
                              onChange={(event) => setEditingItem((previous) => (previous ? { ...previous, name: event.target.value } : previous))}
                              placeholder="Item name"
                              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                            />
                            <input
                              value={editingItem.price}
                              onChange={(event) => setEditingItem((previous) => (previous ? { ...previous, price: event.target.value } : previous))}
                              placeholder="Price (USD)"
                              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                            />
                          </div>
                          <textarea
                            value={editingItem.description}
                            onChange={(event) => setEditingItem((previous) => (previous ? { ...previous, description: event.target.value } : previous))}
                            placeholder="Description"
                            rows={2}
                            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {TAG_OPTIONS.map((tag) => {
                              const selected = editingItem.dietaryTags.includes(tag);
                              return (
                                <button
                                  key={`${item.id}-edit-${tag}`}
                                  type="button"
                                  onClick={() => setEditingItem((previous) => (previous ? { ...previous, dietaryTags: toggleTagValue(previous.dietaryTags, tag) } : previous))}
                                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${selected ? "border-blue-300 bg-blue-100 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveEditedItem(item)}
                              className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditItem}
                              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="grid gap-2 md:grid-cols-[minmax(160px,1.2fr)_minmax(220px,2fr)_100px_150px_95px_220px] md:items-center">
                          <div>
                            <div className="text-xs text-slate-400 md:hidden">Name</div>
                            <div className="font-medium text-slate-900">{item.name}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 md:hidden">Description</div>
                            <div className="text-sm text-slate-500">{item.description || "-"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 md:hidden">Price</div>
                            <div className="text-sm text-slate-700">{formatCents(item.price)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 md:hidden">Tags</div>
                            <div className="flex flex-wrap gap-1">
                              {tags.length === 0 ? (
                                <span className="text-xs text-slate-400">-</span>
                              ) : (
                                tags.map((tag) => (
                                  <span key={`${item.id}-${tag}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                    {tag}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 md:hidden">Available</div>
                            <label className="relative inline-flex h-6 w-11 items-center">
                              <input
                                type="checkbox"
                                checked={item.isAvailable}
                                onChange={(event) => toggleAvailability(item, event.target.checked)}
                                className="peer sr-only"
                              />
                              <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-blue-600" />
                              <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                            </label>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 md:hidden">Actions</div>
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => shiftSort("item", item.id, item.sortOrder, "up", { categoryId: item.categoryId })}
                                className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600"
                                aria-label="Move item up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => shiftSort("item", item.id, item.sortOrder, "down", { categoryId: item.categoryId })}
                                className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600"
                                aria-label="Move item down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditItem(item)}
                                className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 px-2 text-xs font-medium text-slate-700"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem(item)}
                                className="inline-flex h-8 items-center rounded border border-red-200 px-2 text-xs font-medium text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Add item</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px]">
                <input
                  value={newItem.name}
                  onChange={(event) => setNewItemState(category.id, { name: event.target.value })}
                  placeholder="Item name"
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <input
                  value={newItem.price}
                  onChange={(event) => setNewItemState(category.id, { price: event.target.value })}
                  placeholder="Price (USD)"
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                />
              </div>
              <textarea
                value={newItem.description}
                onChange={(event) => setNewItemState(category.id, { description: event.target.value })}
                placeholder="Description"
                rows={2}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => {
                  const selected = newItem.dietaryTags.includes(tag);
                  return (
                    <button
                      key={`${category.id}-new-${tag}`}
                      type="button"
                      onClick={() => setNewItemState(category.id, { dietaryTags: toggleTagValue(newItem.dietaryTags, tag) })}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${selected ? "border-blue-300 bg-blue-100 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => createItem(category.id)}
                className="mt-3 h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
              >
                Add Item
              </button>
            </div>
          </>
        )}
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">POS Menu Sync</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Pull menu items from your connected POS and keep availability in sync.
            </p>
          </div>
          {posSyncInfo?.provider && posSyncInfo.connected ? (
            <button
              type="button"
              onClick={syncPosMenuNow}
              disabled={syncingPos}
              className="h-10 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 disabled:opacity-70"
            >
              {syncingPos ? "Syncing..." : "Sync Now"}
            </button>
          ) : null}
        </div>
        {posSyncInfo?.provider && posSyncInfo.connected ? (
          <p className="mt-2 text-xs text-slate-500">
            Connected to {posProviderLabel}. Last synced: {posSyncInfo.lastSync ? new Date(posSyncInfo.lastSync).toLocaleString() : "Never"}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Connect SpotOn, Square, Toast, or Clover in Settings → Integrations to enable POS sync.
          </p>
        )}
      </section>

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
                    {renamingGroupKey === group.key ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={renameGroupValue}
                          onChange={(event) => setRenameGroupValue(event.target.value)}
                          className="h-11 rounded border border-gray-200 px-3 text-xs"
                          placeholder="Menu label"
                        />
                        <button
                          onClick={() => saveMenuGroupRename(group)}
                          className="h-11 px-3 rounded border border-blue-200 text-blue-700 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelRenameMenuGroup}
                          className="h-11 px-3 rounded border border-gray-200 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRenameMenuGroup(group)}
                        className="h-11 px-3 rounded border border-gray-200 text-xs"
                      >
                        Rename
                      </button>
                    )}
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Express Dining</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Let guests pre-order from your digital menu when making a reservation.
            </p>
          </div>
          <label className={`relative inline-flex h-6 w-11 items-center ${savingExpress ? "opacity-70" : ""}`}>
            <input
              type="checkbox"
              checked={expressEnabled}
              onChange={() => { void toggleExpressDining(); }}
              disabled={savingExpress}
              className="peer sr-only"
              aria-label="Toggle Express Dining"
            />
            <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-blue-600" />
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
        {expressEnabled && (
          <p className="mt-2 text-xs text-emerald-700">
            ✓ Guests can browse your digital menu and pre-order during booking.
          </p>
        )}
      </div>

      {licensed === false ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Digital Menu Builder is part of the Express Dining add-on. Upload-based menu files above still work for public menu display.
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
                onChange={(event) => setNewCategoryType(normalizeCategoryType(event.target.value))}
                className="h-11 border rounded px-3"
              >
                {CATEGORY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button onClick={createCategory} className="h-11 px-4 rounded bg-blue-600 text-white text-sm font-medium">Add Category</button>
            </div>
          </section>

          {groupedByType.length === 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No categories yet. Add your first category to start building the digital menu.
            </section>
          ) : (
            groupedByType.map((group) => (
              <section key={group.type} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{group.label}</h2>
                  <span className="text-xs text-slate-400">{group.categories.length} categories</span>
                </div>
                {group.categories.map(renderCategoryCard)}
              </section>
            ))
          )}
        </>
      ) : null}

      {message && (
        <div className="text-sm text-gray-700 bg-white rounded-lg border px-3 py-2">{message}</div>
      )}
    </div>
  );
}
