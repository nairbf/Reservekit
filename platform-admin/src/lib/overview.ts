import { prisma } from "@/lib/db";
import { HOSTING_MONTHLY_PRICE, PLAN_PRICE } from "@/lib/platform";
import type { HealthStatus, RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";

export async function getLatestHealthMap() {
  const latest = await prisma.healthCheck.findMany({
    orderBy: { checkedAt: "desc" },
  });

  const map = new Map<string, { status: HealthStatus; responseTimeMs: number | null; checkedAt: Date }>();
  for (const row of latest) {
    if (map.has(row.restaurantId)) continue;
    map.set(row.restaurantId, {
      status: row.status,
      responseTimeMs: row.responseTimeMs,
      checkedAt: row.checkedAt,
    });
  }
  return map;
}

export async function getOverviewData() {
  const [restaurants, events] = await Promise.all([
    prisma.restaurant.findMany(),
    prisma.licenseEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true },
        },
      },
    }),
  ]);

  const latestHealth = await getLatestHealthMap();

  const byPlan: Record<RestaurantPlan, number> = {
    CORE: 0,
    SERVICE_PRO: 0,
    FULL_SUITE: 0,
  };

  const byStatus: Record<RestaurantStatus, number> = {
    ACTIVE: 0,
    SUSPENDED: 0,
    TRIAL: 0,
    CANCELLED: 0,
  };

  let oneTimeRevenue = 0;
  let monthlyRevenue = 0;

  const healthSummary: Record<HealthStatus, number> = {
    HEALTHY: 0,
    UNHEALTHY: 0,
    UNREACHABLE: 0,
  };

  for (const restaurant of restaurants) {
    byPlan[restaurant.plan] += 1;
    byStatus[restaurant.status] += 1;

    oneTimeRevenue += PLAN_PRICE[restaurant.plan] || 0;
    if (restaurant.monthlyHostingActive) monthlyRevenue += HOSTING_MONTHLY_PRICE;

    const health = latestHealth.get(restaurant.id);
    if (health) {
      healthSummary[health.status] += 1;
    }
  }

  return {
    totals: {
      restaurants: restaurants.length,
      activeRestaurants: restaurants.filter(row => row.status === "ACTIVE").length,
      oneTimeRevenue,
      monthlyRevenue,
      totalRevenue: oneTimeRevenue + monthlyRevenue,
    },
    byPlan,
    byStatus,
    healthSummary,
    recentLicenseEvents: events,
  };
}
