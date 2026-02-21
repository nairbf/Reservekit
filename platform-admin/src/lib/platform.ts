import path from "path";
import type { RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const PLAN_PRICE: Record<RestaurantPlan, number> = {
  CORE: 29900,
  SERVICE_PRO: 49900,
  FULL_SUITE: 79900,
};

export const HOSTING_MONTHLY_PRICE = 1500;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function maskLicenseKey(key: string) {
  if (!key) return "";
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

export function formatPlan(plan: RestaurantPlan) {
  return plan.replace("_", " ");
}

export function formatStatus(status: RestaurantStatus) {
  return status.replace("_", " ");
}

export function buildRestaurantDbPath(slug: string) {
  const root = process.env.RESTAURANT_DB_ROOT || "/home/reservesit/customers";
  return path.join(root, slug, "reservekit.db");
}

const RESERVED_PORTS = new Set([3001, 3002, 3100, 3200]);

export async function nextAvailablePort(startFrom = 3010): Promise<number> {
  let port = startFrom;
  while (true) {
    if (RESERVED_PORTS.has(port)) {
      port += 1;
      continue;
    }
    const existing = await prisma.restaurant.findFirst({ where: { port } });
    if (!existing) return port;
    port += 1;
  }
}
