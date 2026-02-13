import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteUploadedFile, saveUploadedFile } from "@/lib/uploads";
import { getMenuFiles, saveMenuFiles } from "@/lib/menu-files";

export const runtime = "nodejs";

async function ensureAuth(request: NextRequest) {
  const isPublic = request.nextUrl.searchParams.get("public") === "true";
  if (isPublic) return;
  await requireAuth();
}

export async function GET(request: NextRequest) {
  try {
    await ensureAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const files = await getMenuFiles();
  return NextResponse.json({ files });
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  const labelRaw = String(formData.get("label") || "").trim();
  const label = labelRaw || "Menu";

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "File field is required." }, { status: 400 });
  }

  try {
    const uploaded = await saveUploadedFile(file, { category: "menu" });
    const existing = await getMenuFiles();
    const next = [
      ...existing,
      {
        id: randomUUID(),
        label,
        filename: uploaded.filename,
        url: uploaded.url,
        type: uploaded.type === "application/pdf" ? "pdf" as const : "image" as const,
        order: existing.length,
        uploadedAt: uploaded.uploadedAt,
      },
    ];

    const files = await saveMenuFiles(next);
    return NextResponse.json({ files }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = Array.isArray(body?.files) ? body.files : [];
  const existing = await getMenuFiles();
  const map = new Map(existing.map((file) => [file.id, file]));

  const merged = payload
    .map((entry: { id?: string; label?: string; order?: number }) => {
      const original = entry?.id ? map.get(String(entry.id)) : null;
      if (!original) return null;
      return {
        ...original,
        label: String(entry.label || original.label || "Menu").trim() || "Menu",
        order: Number.isFinite(Number(entry.order)) ? Math.trunc(Number(entry.order)) : original.order,
      };
    })
    .filter(Boolean);

  if (merged.length === 0 && existing.length > 0) {
    return NextResponse.json({ error: "No valid menu files provided." }, { status: 400 });
  }

  const saved = await saveMenuFiles((merged as typeof existing));
  return NextResponse.json({ files: saved });
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ error: "Menu file id is required." }, { status: 400 });

  const existing = await getMenuFiles();
  const target = existing.find((file) => file.id === id);
  if (!target) return NextResponse.json({ error: "Menu file not found." }, { status: 404 });

  try {
    await deleteUploadedFile(target.filename, "menu");
  } catch {
    // Keep going; stale file references should still be removable from settings.
  }

  const next = existing.filter((file) => file.id !== id);
  const saved = await saveMenuFiles(next);
  return NextResponse.json({ files: saved });
}
