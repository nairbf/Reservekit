import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, unauthorized } from "@/lib/api";
import { requireSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminOrSuper } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_UPLOAD_DIR = "/home/reservesit/app/marketing-site/public/uploads";
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function sanitizeNameStem(name: string) {
  return (
    String(name || "upload")
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "upload"
  );
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) return forbidden();

  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const extension = MIME_EXTENSIONS[fileEntry.type];
    if (!extension) {
      return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
    }

    const uploadRoot = process.env.MARKETING_UPLOAD_DIR?.trim() || DEFAULT_UPLOAD_DIR;
    await mkdir(uploadRoot, { recursive: true });

    const safeStem = sanitizeNameStem(fileEntry.name);
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeStem}.${extension}`;
    const fullPath = path.join(uploadRoot, filename);

    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    await writeFile(fullPath, bytes);

    const url = `/uploads/${filename}`;

    await prisma.marketingSetting.upsert({
      where: { key: "hero_image" },
      create: { key: "hero_image", value: url },
      update: { value: url },
    });

    console.log("[MARKETING-SETTINGS][UPLOAD] Uploaded and saved hero image", {
      filename,
      by: session.email,
    });

    return NextResponse.json({ url, saved: true });
  } catch (error) {
    console.error("[MARKETING-SETTINGS][UPLOAD] Failed", error);
    return NextResponse.json(
      {
        error: "Failed to upload image",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
