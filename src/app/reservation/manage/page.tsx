import { prisma } from "@/lib/db";
import { ReservationManager } from "@/components/reservation-manager";

function toSettingsMap(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export const dynamic = "force-dynamic";

export default async function ReservationManagePage() {
  const settingRows = await prisma.setting.findMany({
    where: {
      key: {
        in: ["restaurantName", "accentColor", "logoUrl", "slug", "phone", "contactEmail"],
      },
    },
    select: { key: true, value: true },
  });

  const settings = toSettingsMap(settingRows);

  return (
    <ReservationManager
      restaurantName={settings.restaurantName || "Restaurant"}
      accentColor={settings.accentColor || "#1e3a5f"}
      logoUrl={settings.logoUrl || ""}
      slug={settings.slug || ""}
      phone={settings.phone || ""}
      email={settings.contactEmail || ""}
    />
  );
}
