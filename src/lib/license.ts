import { prisma } from "./db";
import { getSession } from "./auth";

const PREFIXES: Record<string, string> = {
  sms: "RS-SMS-",
  floorplan: "RS-FLR-",
  reports: "RS-RPT-",
  guesthistory: "RS-GST-",
  pos: "RS-POS-",
  multilocation: "RS-MLT-",
  events: "RS-EVT-",
  eventticketing: "RS-EVT-",
};

async function isAdminSession(): Promise<boolean> {
  try {
    const session = await getSession();
    return session?.role === "admin";
  } catch {
    return false;
  }
}

export async function isModuleActive(module: string, options?: { allowAdminBypass?: boolean }): Promise<boolean> {
  const allowAdminBypass = options?.allowAdminBypass ?? true;
  const row = await prisma.setting.findUnique({ where: { key: `license_${module}` } });
  const value = String(row?.value || "").toUpperCase();
  const prefix = PREFIXES[module];
  if (!prefix) return false;

  if (value.startsWith(prefix)) {
    const suffix = value.slice(prefix.length);
    if (suffix.length === 8 && /^[A-Z0-9]+$/.test(suffix)) return true;
  }

  if (allowAdminBypass) {
    return isAdminSession();
  }

  return false;
}
