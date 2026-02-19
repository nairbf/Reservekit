import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getEnabledFeatures } from "@/lib/features";
import { getRestaurantTimezone, getTodayInTimezone } from "@/lib/timezone";

export async function GET() {
  try { await requirePermission("manage_staff"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const timezone = await getRestaurantTimezone();
  const today = getTodayInTimezone(timezone);
  const [
    usersTotal,
    usersActive,
    reservationsTotal,
    reservationsToday,
    guestsTotal,
    tablesTotal,
    pendingCount,
    settingsCount,
    features,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.reservation.count(),
    prisma.reservation.count({ where: { date: today } }),
    prisma.guest.count(),
    prisma.restaurantTable.count(),
    prisma.reservation.count({ where: { status: "pending" } }),
    prisma.setting.count(),
    getEnabledFeatures(),
  ]);

  const basicSettings = await prisma.setting.findMany({
    where: {
      key: {
        in: ["restaurantName", "phone", "address", "timezone", "openTime", "closeTime"],
      },
    },
    select: { key: true, value: true },
  });
  const settings: Record<string, string> = {};
  for (const row of basicSettings) settings[row.key] = row.value;

  return NextResponse.json({
    today,
    stats: {
      usersTotal,
      usersActive,
      reservationsTotal,
      reservationsToday,
      guestsTotal,
      tablesTotal,
      pendingCount,
      settingsCount,
    },
    features,
    restaurant: {
      name: settings.restaurantName || "Restaurant",
      phone: settings.phone || "",
      address: settings.address || "",
      timezone: settings.timezone || "America/New_York",
      openTime: settings.openTime || "17:00",
      closeTime: settings.closeTime || "22:00",
    },
  });
}
