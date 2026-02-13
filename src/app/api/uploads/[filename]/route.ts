import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteUploadedFile, sanitizeSegment } from "@/lib/uploads";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename || "");
  const categoryParam = request.nextUrl.searchParams.get("category") || "general";
  const category = sanitizeSegment(categoryParam);

  if (!filename || filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  }

  try {
    await deleteUploadedFile(filename, category);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete file." }, { status: 404 });
  }
}
