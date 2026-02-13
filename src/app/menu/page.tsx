import Link from "next/link";
import { prisma } from "@/lib/db";
import { getMenuFiles } from "@/lib/menu-files";
import { MenuFileViewer } from "@/components/menu-file-viewer";

function toSettingsMap(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function formatCents(cents: number) {
  return `$${(Math.max(0, Math.trunc(cents)) / 100).toFixed(2)}`;
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value || "").trim());
}

export const dynamic = "force-dynamic";

export default async function PublicMenuPage() {
  const [settingRows, uploadedFiles, categories] = await Promise.all([
    prisma.setting.findMany({
      where: {
        key: { in: ["restaurantName", "accentColor", "slug"] },
      },
    }),
    getMenuFiles(),
    prisma.menuCategory.findMany({
      where: { isActive: true },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const settings = toSettingsMap(settingRows);
  const restaurantName = settings.restaurantName || "The Reef Restaurant";
  const accentColor = isHexColor(settings.accentColor || "") ? settings.accentColor : "#1e3a5f";
  const slug = settings.slug || "reef";
  const reserveHref = `/reserve/${encodeURIComponent(slug)}`;
  const hasUploaded = uploadedFiles.length > 0;
  const activeCategories = categories.filter((category) => category.items.length > 0);

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{restaurantName}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight font-serif">Menu</h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600">Browse our latest offerings. Downloadable menus are updated by the restaurant team.</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12 sm:px-8 lg:px-10">
        {hasUploaded ? (
          <MenuFileViewer files={uploadedFiles} accentColor={accentColor} />
        ) : activeCategories.length > 0 ? (
          <div className="space-y-4">
            {activeCategories.map((category) => (
              <article key={category.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-semibold font-serif">{category.name}</h2>
                <div className="mt-4 space-y-3">
                  {category.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                      <div>
                        <h3 className="text-base font-semibold">{item.name}</h3>
                        {item.description ? <p className="text-sm text-gray-600">{item.description}</p> : null}
                      </div>
                      <span className="text-sm font-semibold">{formatCents(item.price)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <h2 className="text-2xl font-semibold font-serif">Menu Coming Soon</h2>
            <p className="mt-2 text-sm text-gray-600">This restaurant will publish menu files here shortly.</p>
          </div>
        )}
      </section>

      <section className="border-t border-gray-200 bg-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 sm:px-8 lg:px-10">
          <p className="text-sm text-gray-600">Ready to book your table?</p>
          <Link
            href={reserveHref}
            className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            Reserve a Table
          </Link>
        </div>
      </section>
    </main>
  );
}
