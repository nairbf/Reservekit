import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { MAX_UPLOAD_SIZE_BYTES, listUploadedFiles, saveUploadedFile, sanitizeSegment } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categoryParam = request.nextUrl.searchParams.get("category") || "general";
  const category = sanitizeSegment(categoryParam);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "File field is required." }, { status: 400 });
  }

  try {
    const saved = await saveUploadedFile(file, {
      category,
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categoryParam = request.nextUrl.searchParams.get("category");
  const category = categoryParam ? sanitizeSegment(categoryParam) : undefined;
  const files = await listUploadedFiles(category);
  return NextResponse.json({ files });
}
