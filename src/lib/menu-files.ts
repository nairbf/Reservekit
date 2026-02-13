import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

export type MenuFileType = "pdf" | "image";

export interface MenuFileEntry {
  id: string;
  label: string;
  filename: string;
  url: string;
  type: MenuFileType;
  order: number;
  uploadedAt: string;
}

function normalizeType(value: string): MenuFileType {
  if (String(value || "").toLowerCase() === "pdf") return "pdf";
  return "image";
}

export function parseMenuFiles(raw: string | null | undefined): MenuFileEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const row = item as Partial<MenuFileEntry>;
        return {
          id: String(row.id || randomUUID()),
          label: String(row.label || "Menu"),
          filename: String(row.filename || ""),
          url: String(row.url || ""),
          type: normalizeType(String(row.type || "image")),
          order: Number.isFinite(Number(row.order)) ? Math.trunc(Number(row.order)) : 0,
          uploadedAt: String(row.uploadedAt || new Date().toISOString()),
        };
      })
      .filter((item) => item.filename && item.url)
      .sort((a, b) => a.order - b.order || a.uploadedAt.localeCompare(b.uploadedAt));
  } catch {
    return [];
  }
}

export async function getMenuFiles(): Promise<MenuFileEntry[]> {
  const row = await prisma.setting.findUnique({ where: { key: "menu_files" } });
  return parseMenuFiles(row?.value);
}

export async function saveMenuFiles(files: MenuFileEntry[]): Promise<MenuFileEntry[]> {
  const normalized = files
    .map((file, index) => ({
      ...file,
      id: String(file.id || randomUUID()),
      label: String(file.label || "Menu"),
      filename: String(file.filename || ""),
      url: String(file.url || ""),
      type: normalizeType(file.type),
      order: Number.isFinite(Number(file.order)) ? Math.trunc(Number(file.order)) : index,
      uploadedAt: String(file.uploadedAt || new Date().toISOString()),
    }))
    .filter((file) => file.filename && file.url)
    .sort((a, b) => a.order - b.order || a.uploadedAt.localeCompare(b.uploadedAt))
    .map((file, index) => ({ ...file, order: index }));

  await prisma.setting.upsert({
    where: { key: "menu_files" },
    create: { key: "menu_files", value: JSON.stringify(normalized) },
    update: { value: JSON.stringify(normalized) },
  });

  return normalized;
}
