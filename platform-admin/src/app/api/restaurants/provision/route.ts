import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { HostingStatus, LicenseEventType, RestaurantPlan, RestaurantStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSessionFromRequest } from "@/lib/auth";
import { badRequest, forbidden, unauthorized } from "@/lib/api";
import { isAdminOrSuper } from "@/lib/rbac";
import { buildRestaurantDbPath, slugify } from "@/lib/platform";
import { createLicenseEvent } from "@/lib/license-events";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = "/home/reservesit/scripts/setup-restaurant.sh";
const SCRIPT_CWD = "/home/reservesit/app";

function parsePlan(value: unknown): RestaurantPlan {
  const normalized = String(value || "CORE").toUpperCase();
  if (normalized === "CORE" || normalized === "SERVICE_PRO" || normalized === "FULL_SUITE") {
    return normalized;
  }
  return "CORE";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidSlug(value: string) {
  return /^[a-z0-9-]+$/.test(value);
}

function parseGeneratedPassword(output: string) {
  const match = output.match(/Login:\s*\S+\s*\/\s*(\S+)/i);
  return match?.[1] || "check-server-logs";
}

function generateLicenseKey(slug: string) {
  const slugPart = slug.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "RESTAURANT";
  const randomPart = Date.now().toString(36).toUpperCase();
  return `RS-${slugPart}-${randomPart}`;
}

type ProvisionBody = {
  restaurantId?: string;
  name?: string;
  slug?: string;
  ownerEmail?: string;
  plan?: string;
  port?: number;
};

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = requireSessionFromRequest(req);
  } catch {
    return unauthorized();
  }

  if (!isAdminOrSuper(session.role)) return forbidden();

  const body = (await req.json().catch(() => ({}))) as ProvisionBody;
  const reprovisionId = String(body.restaurantId || "").trim();

  let restaurant = reprovisionId
    ? await prisma.restaurant.findUnique({ where: { id: reprovisionId } })
    : null;

  if (reprovisionId && !restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const name = restaurant?.name || String(body.name || "").trim();
  const rawSlug = restaurant?.slug || String(body.slug || "").trim().toLowerCase();
  const slug = slugify(rawSlug);
  const ownerEmail = (restaurant?.ownerEmail || restaurant?.adminEmail || String(body.ownerEmail || "")).trim().toLowerCase();
  const plan = restaurant?.plan || parsePlan(body.plan);
  const port = restaurant?.port || Number(body.port);

  if (!name || !slug || !ownerEmail || !Number.isFinite(port)) {
    return badRequest("Missing required fields");
  }

  if (!isValidSlug(slug)) {
    return badRequest("Slug must be lowercase letters, numbers, and hyphens only");
  }

  if (!isValidEmail(ownerEmail)) {
    return badRequest("Owner email is invalid");
  }

  if (!Number.isInteger(port) || port < 3003 || port > 9999) {
    return badRequest("Port must be between 3003 and 9999");
  }

  if (!restaurant) {
    const [existingSlug, existingPort] = await Promise.all([
      prisma.restaurant.findUnique({ where: { slug }, select: { id: true } }),
      prisma.restaurant.findUnique({ where: { port }, select: { id: true } }),
    ]);

    if (existingSlug) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }

    if (existingPort) {
      return NextResponse.json({ error: "Port already in use" }, { status: 409 });
    }

    restaurant = await prisma.restaurant.create({
      data: {
        name,
        slug,
        domain: `${slug}.reservesit.com`,
        adminEmail: ownerEmail,
        ownerEmail,
        plan,
        port,
        dbPath: buildRestaurantDbPath(slug),
        licenseKey: generateLicenseKey(slug),
        status: RestaurantStatus.ACTIVE,
        provisionStatus: "provisioning",
        hosted: true,
        hostingStatus: HostingStatus.ACTIVE,
        monthlyHostingActive: true,
        licenseActivatedAt: new Date(),
      },
    });

    await createLicenseEvent({
      restaurantId: restaurant.id,
      event: LicenseEventType.LICENSE_CREATED,
      details: `Provision request queued for ${slug}`,
      performedBy: session.email,
    });
  } else {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        provisionStatus: "provisioning",
        provisionLog: null,
        generatedPassword: null,
      },
    });
  }

  try {
    const { stdout = "", stderr = "" } = await execFileAsync(
      SCRIPT_PATH,
      [slug, ownerEmail, name, String(port)],
      {
        cwd: SCRIPT_CWD,
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    );

    const generatedPassword = parseGeneratedPassword(stdout);
    const provisionLog = `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        provisionStatus: "active",
        provisionLog,
        generatedPassword,
        status: RestaurantStatus.ACTIVE,
      },
    });

    await createLicenseEvent({
      restaurantId: restaurant.id,
      event: LicenseEventType.ACTIVATED,
      details: `Provisioning completed for ${slug}`,
      performedBy: session.email,
    });

    return NextResponse.json({
      success: true,
      restaurant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        ownerEmail: updated.ownerEmail || updated.adminEmail,
        url: `https://${updated.domain || `${updated.slug}.reservesit.com`}`,
        password: generatedPassword,
        plan: updated.plan,
        licenseKey: updated.licenseKey,
        port: updated.port,
        provisionStatus: updated.provisionStatus,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stdout = typeof error === "object" && error && "stdout" in error ? String((error as { stdout?: unknown }).stdout || "") : "";
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as { stderr?: unknown }).stderr || "") : "";
    const provisionLog = [`ERROR: ${errorMessage}`, stdout, stderr].filter(Boolean).join("\n").trim();

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        provisionStatus: "failed",
        provisionLog,
      },
    });

    await createLicenseEvent({
      restaurantId: restaurant.id,
      event: LicenseEventType.SETTINGS_UPDATED,
      details: `Provisioning failed for ${slug}: ${errorMessage}`,
      performedBy: session.email,
    });

    return NextResponse.json(
      {
        error: "Provisioning failed",
        details: errorMessage,
        restaurantId: restaurant.id,
      },
      { status: 500 },
    );
  }
}
