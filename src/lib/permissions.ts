export const ALL_PERMISSIONS = [
  { key: "view_dashboard", label: "View Dashboard", category: "Core", description: "" },
  { key: "manage_reservations", label: "Manage Reservations", category: "Core", description: "Create, edit, cancel reservations" },
  { key: "checkin_guests", label: "Check-in & Seat Guests", category: "Core", description: "" },
  { key: "manage_waitlist", label: "Manage Waitlist", category: "Core", description: "" },
  { key: "tonight_view", label: "Tonight View", category: "Core", description: "" },

  { key: "manage_schedule", label: "Manage Schedule", category: "Operations", description: "Edit hours and day overrides" },
  { key: "manage_tables", label: "Manage Tables", category: "Operations", description: "" },
  { key: "manage_menu", label: "Manage Menu", category: "Operations", description: "" },
  { key: "manage_events", label: "Manage Events", category: "Operations", description: "" },
  { key: "view_reports", label: "View Reports", category: "Operations", description: "" },
  { key: "view_guests", label: "View Guest History", category: "Operations", description: "" },

  { key: "manage_staff", label: "Manage Staff Accounts", category: "Admin", description: "" },
  { key: "manage_settings", label: "Manage Settings", category: "Admin", description: "" },
  { key: "manage_billing", label: "Manage Billing & Stripe", category: "Admin", description: "" },
  { key: "manage_integrations", label: "Manage Integrations", category: "Admin", description: "" },
] as const;

export type PermissionKey = typeof ALL_PERMISSIONS[number]["key"];

const ALL_KEYS = ALL_PERMISSIONS.map((permission) => permission.key) as PermissionKey[];
const ALL_KEYS_SET = new Set<PermissionKey>(ALL_KEYS);

export const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  admin: ALL_KEYS,
  superadmin: ALL_KEYS,
  manager: [
    "view_dashboard",
    "manage_reservations",
    "checkin_guests",
    "manage_waitlist",
    "tonight_view",
    "manage_schedule",
    "manage_tables",
    "manage_menu",
    "manage_events",
    "view_reports",
    "view_guests",
  ],
  host: [
    "view_dashboard",
    "checkin_guests",
    "manage_waitlist",
    "tonight_view",
  ],
};

export function getRoleDefaultPermissions(role: string): Set<PermissionKey> {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const defaults = ROLE_DEFAULTS[normalizedRole] || ROLE_DEFAULTS.host;
  return new Set<PermissionKey>(defaults);
}

export function parsePermissionOverrides(permissionsJson: string | null | undefined): Partial<Record<PermissionKey, boolean>> {
  if (!permissionsJson) return {};
  try {
    const parsed = JSON.parse(permissionsJson) as Record<string, boolean>;
    const result: Partial<Record<PermissionKey, boolean>> = {};
    for (const [key, value] of Object.entries(parsed || {})) {
      if (ALL_KEYS_SET.has(key as PermissionKey) && typeof value === "boolean") {
        result[key as PermissionKey] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function getUserPermissions(role: string, permissionsJson: string | null | undefined): Set<PermissionKey> {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const permissions =
    normalizedRole === "admin" || normalizedRole === "superadmin"
      ? new Set<PermissionKey>(ALL_KEYS)
      : getRoleDefaultPermissions(normalizedRole);

  if (normalizedRole !== "admin" && normalizedRole !== "superadmin") {
    const overrides = parsePermissionOverrides(permissionsJson);
    for (const [key, enabled] of Object.entries(overrides)) {
      const permission = key as PermissionKey;
      if (!ALL_KEYS_SET.has(permission) || permission === "view_dashboard") continue;
      if (enabled) permissions.add(permission);
      else permissions.delete(permission);
    }
  }

  // Dashboard entry remains available to all authenticated users.
  permissions.add("view_dashboard");
  return permissions;
}

export function hasPermission(permissions: Set<PermissionKey>, key: PermissionKey): boolean {
  return permissions.has(key);
}

export function buildPermissionOverrides(role: string, selectedPermissions: Iterable<PermissionKey>): string | null {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "superadmin") return null;

  const selected = new Set<PermissionKey>(selectedPermissions);
  selected.add("view_dashboard");
  const defaults = getRoleDefaultPermissions(normalizedRole);
  const overrides: Partial<Record<PermissionKey, boolean>> = {};

  for (const key of ALL_KEYS) {
    if (key === "view_dashboard") continue;
    const inDefaults = defaults.has(key);
    const inSelected = selected.has(key);
    if (inDefaults && !inSelected) overrides[key] = false;
    if (!inDefaults && inSelected) overrides[key] = true;
  }

  return Object.keys(overrides).length ? JSON.stringify(overrides) : null;
}

export function getPermissionKeys(): PermissionKey[] {
  return [...ALL_KEYS];
}

export const PATH_PERMISSIONS: Record<string, PermissionKey> = {
  "/dashboard": "view_dashboard",
  "/dashboard/tonight": "tonight_view",
  "/dashboard/schedule": "manage_schedule",
  "/dashboard/tables": "manage_tables",
  "/dashboard/menu": "manage_menu",
  "/dashboard/events": "manage_events",
  "/dashboard/reports": "view_reports",
  "/dashboard/guests": "view_guests",
  "/dashboard/waitlist": "manage_waitlist",
  "/dashboard/settings": "manage_settings",
  "/dashboard/admin": "manage_staff",
  "/dashboard/floorplan": "manage_tables",
  "/dashboard/kitchen": "manage_menu",
};

export const API_PERMISSIONS: Record<string, PermissionKey> = {
  "/api/reservations": "manage_reservations",
  "/api/tables": "manage_tables",
  "/api/settings": "manage_settings",
  "/api/admin": "manage_staff",
  "/api/reports": "view_reports",
  "/api/guests": "view_guests",
  "/api/events": "manage_events",
  "/api/menu": "manage_menu",
  "/api/day-overrides": "manage_schedule",
  "/api/waitlist": "manage_waitlist",
  "/api/payments": "manage_billing",
  "/api/pos": "manage_integrations",
  "/api/spoton": "manage_integrations",
};
