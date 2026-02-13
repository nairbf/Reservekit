import type { HealthStatus, RestaurantPlan, RestaurantStatus, HostingStatus } from "@/generated/prisma/client";

function cls(base: string, value: string) {
  if (value === "ACTIVE" || value === "HEALTHY") return `${base} bg-emerald-100 text-emerald-800 ring-emerald-200`;
  if (value === "TRIAL") return `${base} bg-amber-100 text-amber-900 ring-amber-200`;
  if (value === "SUSPENDED" || value === "UNHEALTHY") return `${base} bg-rose-100 text-rose-900 ring-rose-200`;
  if (value === "CANCELLED" || value === "UNREACHABLE") return `${base} bg-slate-200 text-slate-700 ring-slate-300`;
  return `${base} bg-slate-100 text-slate-700 ring-slate-200`;
}

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset";

export function RestaurantStatusBadge({ status }: { status: RestaurantStatus }) {
  return <span className={cls(base, status)}>{status.replaceAll("_", " ")}</span>;
}

export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  return <span className={cls(base, status)}>{status.replaceAll("_", " ")}</span>;
}

export function HostingStatusBadge({ status }: { status: HostingStatus }) {
  return <span className={cls(base, status)}>{status.replaceAll("_", " ")}</span>;
}

export function PlanBadge({ plan }: { plan: RestaurantPlan }) {
  const color =
    plan === "FULL_SUITE"
      ? "bg-indigo-100 text-indigo-800 ring-indigo-200"
      : plan === "SERVICE_PRO"
        ? "bg-sky-100 text-sky-900 ring-sky-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  return <span className={`${base} ${color}`}>{plan.replaceAll("_", " ")}</span>;
}
