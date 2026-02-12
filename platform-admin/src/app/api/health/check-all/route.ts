import { NextRequest, NextResponse } from "next/server";
import { HealthStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

async function ping(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const responseTimeMs = Date.now() - started;
    if (!response.ok) {
      return {
        status: HealthStatus.UNHEALTHY,
        responseTimeMs,
      };
    }

    return {
      status: HealthStatus.HEALTHY,
      responseTimeMs,
    };
  } catch {
    return {
      status: HealthStatus.UNREACHABLE,
      responseTimeMs: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  try {
    requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      port: true,
    },
  });
  const activeRestaurants = restaurants.filter((row) => row.status === "ACTIVE");

  const checks = await Promise.all(
    activeRestaurants.map(async (restaurant) => {
      const result = await ping(`http://127.0.0.1:${restaurant.port}/api/health`, 5000);

      await prisma.healthCheck.create({
        data: {
          restaurantId: restaurant.id,
          status: result.status,
          responseTimeMs: result.responseTimeMs,
        },
      });

      return {
        restaurantId: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        status: result.status,
        responseTimeMs: result.responseTimeMs,
        checkedAt: new Date().toISOString(),
      };
    }),
  );

  const latestHistory = await prisma.healthCheck.findMany({
    orderBy: { checkedAt: "desc" },
    select: {
      restaurantId: true,
      status: true,
      responseTimeMs: true,
      checkedAt: true,
    },
  });

  const latestMap = new Map<
    string,
    { status: HealthStatus; responseTimeMs: number | null; checkedAt: Date }
  >();
  for (const row of latestHistory) {
    if (latestMap.has(row.restaurantId)) continue;
    latestMap.set(row.restaurantId, {
      status: row.status,
      responseTimeMs: row.responseTimeMs,
      checkedAt: row.checkedAt,
    });
  }

  const result = restaurants.map((restaurant) => {
    const direct = checks.find((check) => check.restaurantId === restaurant.id);
    if (direct) {
      return {
        ...direct,
        isActive: true,
      };
    }

    const previous = latestMap.get(restaurant.id);
    if (previous) {
      return {
        restaurantId: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        status: previous.status,
        responseTimeMs: previous.responseTimeMs,
        checkedAt: previous.checkedAt.toISOString(),
        isActive: false,
      };
    }

    return {
      restaurantId: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      status: HealthStatus.UNREACHABLE,
      responseTimeMs: null,
      checkedAt: new Date().toISOString(),
      isActive: false,
    };
  });

  const summary = {
    total: result.length,
    healthy: result.filter((row) => row.status === HealthStatus.HEALTHY).length,
    unhealthy: result.filter((row) => row.status === HealthStatus.UNHEALTHY).length,
    unreachable: result.filter((row) => row.status === HealthStatus.UNREACHABLE).length,
    activeChecked: checks.length,
  };

  return NextResponse.json({ summary, checks: result });
}
