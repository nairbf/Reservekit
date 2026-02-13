import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_EXTENSIONS));

export interface UploadedFileInfo {
  filename: string;
  category: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

function cleanEnvUrl(value: string): string {
  return String(value || "").replace(/^['"]|['"]$/g, "");
}

export function getRestaurantSlugFromDatabaseUrl(databaseUrl: string): string {
  const normalized = cleanEnvUrl(databaseUrl);
  const match = normalized.match(/customers\/([^/]+)\//);
  if (match?.[1]) return sanitizeSegment(match[1]);
  return "default";
}

export function getUploadDirFromEnv(): string {
  const dbUrl = process.env.DATABASE_URL || "";
  const slug = getRestaurantSlugFromDatabaseUrl(dbUrl);
  const root = process.env.RESTAURANT_UPLOAD_ROOT || "/home/reservesit/customers";

  if (slug !== "default") {
    return path.join(root, slug, "uploads");
  }

  return path.resolve(process.cwd(), ".uploads", slug, "uploads");
}

export function sanitizeSegment(value: string): string {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "general";
}

function sanitizeFilenameStem(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  const normalized = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized) return normalized;
  return createHash("sha1").update(filename).digest("hex").slice(0, 8);
}

function detectMimeFromMagic(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2d) {
    return "application/pdf";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return "image/png";
  }

  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
    return "image/gif";
  }

  if (buffer.length >= 12) {
    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);
    if (riff === "RIFF" && webp === "WEBP") {
      return "image/webp";
    }
  }

  return null;
}

export function getMimeTypeForFileName(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

function toStoredFileName(originalFileName: string, mimeType: string): string {
  const stem = sanitizeFilenameStem(originalFileName || "upload");
  const ext = MIME_EXTENSIONS[mimeType] || "bin";
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${stem}.${ext}`;
}

export async function saveUploadedFile(
  file: File,
  options?: { category?: string; maxSizeBytes?: number },
): Promise<UploadedFileInfo> {
  const category = sanitizeSegment(options?.category || "general");
  const maxSize = options?.maxSizeBytes || MAX_UPLOAD_SIZE_BYTES;

  if (!file) throw new Error("File is required.");
  if (file.size <= 0) throw new Error("File is empty.");
  if (file.size > maxSize) throw new Error(`File exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit.`);

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = detectMimeFromMagic(bytes);
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported file type. Allowed: PDF, JPG, PNG, WEBP, GIF.");
  }

  const uploadDir = path.join(getUploadDirFromEnv(), category);
  await mkdir(uploadDir, { recursive: true });

  const filename = toStoredFileName(file.name, mimeType);
  const targetPath = path.join(uploadDir, filename);
  await writeFile(targetPath, bytes);

  return {
    filename,
    category,
    url: `/api/uploads/serve/${category}/${filename}`,
    size: file.size,
    type: mimeType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteUploadedFile(filename: string, category = "general") {
  const safeCategory = sanitizeSegment(category);
  const safeFilename = path.basename(filename || "");
  if (!safeFilename || safeFilename.includes("..")) {
    throw new Error("Invalid filename.");
  }

  const fullPath = path.join(getUploadDirFromEnv(), safeCategory, safeFilename);
  await unlink(fullPath);
}

export function resolveUploadPath(segments: string[]): { fullPath: string; mimeType: string } {
  if (!Array.isArray(segments) || segments.length < 2) {
    throw new Error("Invalid upload path.");
  }

  const cleaned = segments.map((segment) => path.basename(segment));
  const baseDir = getUploadDirFromEnv();
  const fullPath = path.resolve(baseDir, ...cleaned);
  const safeBase = path.resolve(baseDir);

  if (!fullPath.startsWith(`${safeBase}${path.sep}`)) {
    throw new Error("Invalid upload path.");
  }

  const mimeType = getMimeTypeForFileName(cleaned[cleaned.length - 1]);
  return { fullPath, mimeType };
}

export async function readUploadFile(segments: string[]): Promise<{ bytes: Buffer; mimeType: string }> {
  const { fullPath, mimeType } = resolveUploadPath(segments);
  const bytes = await readFile(fullPath);
  return { bytes, mimeType };
}

export async function listUploadedFiles(category?: string): Promise<UploadedFileInfo[]> {
  const baseDir = getUploadDirFromEnv();
  const categories = category ? [sanitizeSegment(category)] : [];

  if (!category) {
    try {
      const dirs = await readdir(baseDir, { withFileTypes: true });
      for (const entry of dirs) {
        if (entry.isDirectory()) categories.push(entry.name);
      }
    } catch {
      return [];
    }
  }

  const files: UploadedFileInfo[] = [];

  for (const currentCategory of categories) {
    const categoryDir = path.join(baseDir, currentCategory);
    let entries: string[] = [];
    try {
      entries = await readdir(categoryDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const safeName = path.basename(entry);
      const fullPath = path.join(categoryDir, safeName);
      try {
        const info = await stat(fullPath);
        if (!info.isFile()) continue;
        files.push({
          filename: safeName,
          category: currentCategory,
          url: `/api/uploads/serve/${currentCategory}/${safeName}`,
          size: info.size,
          type: getMimeTypeForFileName(safeName),
          uploadedAt: info.mtime.toISOString(),
        });
      } catch {
        continue;
      }
    }
  }

  return files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}
