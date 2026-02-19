"use client";

import { createContext, useContext } from "react";
import type { PermissionKey } from "@/lib/permissions";

const PermissionsContext = createContext<Set<PermissionKey>>(new Set<PermissionKey>());

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={new Set(permissions as PermissionKey[])}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function useHasPermission(key: PermissionKey) {
  const permissions = usePermissions();
  return permissions.has(key);
}

