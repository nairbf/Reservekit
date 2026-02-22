import { NextRequest, NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { getOverviewData } from "@/lib/overview";

function emptyOverview() {
  return {
    totals: {
      restaurants: 0,
      activeRestaurants: 0,
      oneTimeRevenue: 0,
      monthlyRevenue: 0,
      totalRevenue: 0,
    },
    byPlan: {
      CORE: 0,
      SERVICE_PRO: 0,
      FULL_SUITE: 0,
    },
    byStatus: {
      ACTIVE: 0,
      SUSPENDED: 0,
      TRIAL: 0,
      CANCELLED: 0,
    },
    healthSummary: {
      HEALTHY: 0,
      UNHEALTHY: 0,
      UNREACHABLE: 0,
    },
    recentLicenseEvents: [],
  };
}

export async function GET(req: NextRequest) {
  try {
    requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  try {
    const data = await getOverviewData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[PLATFORM DASHBOARD] Failed to load overview", error);
    return NextResponse.json(emptyOverview());
  }
}
