import { NextRequest, NextResponse } from "next/server";
import { readUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const { bytes, mimeType } = await readUploadFile(path);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
