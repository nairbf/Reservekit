import fs from "fs";
import path from "path";

let fileEnv: Record<string, string> | null = null;

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvFile(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (!key) continue;
    const rawValue = line.slice(eqIndex + 1);
    parsed[key] = stripOuterQuotes(rawValue);
  }
  return parsed;
}

function loadEnvFromDisk(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "marketing-site/.env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../marketing-site/.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const contents = fs.readFileSync(candidate, "utf8");
      return parseEnvFile(contents);
    } catch {
      // Ignore unreadable candidates and keep searching.
    }
  }

  return {};
}

export function getServerEnv(key: string): string | undefined {
  const direct = process.env[key]?.trim();
  if (direct) return direct;

  if (fileEnv === null) {
    fileEnv = loadEnvFromDisk();
  }

  const fromFile = fileEnv[key]?.trim();
  return fromFile || undefined;
}
