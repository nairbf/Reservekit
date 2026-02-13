import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["restaurantName", "faviconUrl"] } },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  const restaurantName = map.restaurantName || "ReserveSit";
  const faviconUrl = map.faviconUrl || "";

  return {
    title: restaurantName,
    description: "Restaurant reservation system",
    icons: faviconUrl
      ? {
          icon: [{ url: faviconUrl }],
          shortcut: [{ url: faviconUrl }],
          apple: [{ url: faviconUrl }],
        }
      : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}
