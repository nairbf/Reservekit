import type { PlatformRole } from "@/generated/prisma/client";

export function isSuperAdmin(role: PlatformRole) {
  return role === "SUPER_ADMIN";
}

export function isAdminOrSuper(role: PlatformRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSupport(role: PlatformRole) {
  return role === "SUPPORT";
}
