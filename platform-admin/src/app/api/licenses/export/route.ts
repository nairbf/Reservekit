import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

function csvEscape(value: string | number | null) {
  const raw = value === null ? "" : String(value);
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replaceAll("\"", '""')}"`;
  }
  return raw;
}

export async function GET() {
  try {
    await requireSession();
  } catch {
    return unauthorized();
  }

  const rows = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      slug: true,
      licenseKey: true,
      plan: true,
      status: true,
      licenseActivatedAt: true,
      createdAt: true,
    },
  });

  const header = [
    "name",
    "slug",
    "license_key",
    "plan",
    "status",
    "license_activated_at",
    "created_at",
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.slug,
        row.licenseKey,
        row.plan,
        row.status,
        row.licenseActivatedAt ? row.licenseActivatedAt.toISOString() : "",
        row.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservesit-licenses-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
