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

export async function nextAvailablePort(start = 3001) {
  const rows = await prisma.restaurant.findMany({
    select: { port: true },
    orderBy: { port: "asc" },
  });

  let candidate = start;
  for (const row of rows) {
    if (row.port === candidate) candidate += 1;
    if (row.port > candidate) break;
  }
  return candidate;
}
