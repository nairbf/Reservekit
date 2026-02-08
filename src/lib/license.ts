import { prisma } from "./db";

const PREFIXES: Record<string, string> = {
  sms: "RK-SMS-",
  floorplan: "RK-FLR-",
  reports: "RK-RPT-",
  guesthistory: "RK-GST-",
  multilocation: "RK-MLT-",
};

export async function isModuleActive(module: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: `license_${module}` } });
  if (!row?.value) return false;
  const prefix = PREFIXES[module];
  if (!prefix || !row.value.startsWith(prefix)) return false;
  const suffix = row.value.slice(prefix.length);
  return suffix.length === 8 && /^[A-Z0-9]+$/.test(suffix);
}
