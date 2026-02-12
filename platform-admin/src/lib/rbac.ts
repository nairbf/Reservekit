import type { PlatformRole } from "@/generated/prisma/client";
import { requireSession } from "@/lib/auth";

export function isSuperAdmin(role: PlatformRole) {
  return role === "SUPER_ADMIN";
}

export function isAdminOrSuper(role: PlatformRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSupport(role: PlatformRole) {
  return role === "SUPPORT";
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (!isSuperAdmin(session.role)) throw new Error("Forbidden");
  return session;
}

export async function requireAdminOrSuper() {
  const session = await requireSession();
  if (!isAdminOrSuper(session.role)) throw new Error("Forbidden");
  return session;
}
