import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAppUrlFromRequest } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { getAvailableProviders, getPosAdapter, isPosProvider, type PosProvider } from "@/lib/pos";

export const runtime = "nodejs";

function stateKey(provider: PosProvider) {
  return `pos_oauth_state_${provider}`;
}

function credentialsKey(provider: PosProvider) {
  return `pos_credentials_${provider}`;
}

function appBaseUrl(req: NextRequest) {
  return getAppUrlFromRequest(req);
}

function providerIsAvailable(provider: PosProvider) {
  return getAvailableProviders().some((adapter) => adapter.provider === provider);
}

function settingsRedirect(req: NextRequest, provider: PosProvider, connected: boolean, error?: string) {
  const url = new URL("/dashboard/settings", appBaseUrl(req));
  url.searchParams.set("tab", "integrations");
  url.searchParams.set("provider", provider);
  if (connected) url.searchParams.set("connected", "true");
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.redirect(new URL("/login", appBaseUrl(req)));
  }

  const { provider: providerRaw } = await params;
  if (!isPosProvider(providerRaw) || !providerIsAvailable(providerRaw)) {
    return settingsRedirect(req, "square", false, "Unsupported POS provider");
  }

  const provider = providerRaw as PosProvider;
  const adapter = getPosAdapter(provider);

  const providerError = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");
  if (providerError) {
    return settingsRedirect(req, provider, false, providerError);
  }

  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  if (!code || !state) {
    return settingsRedirect(req, provider, false, "Missing OAuth code or state");
  }

  const savedState = await prisma.setting.findUnique({ where: { key: stateKey(provider) } });
  if (!savedState?.value) {
    return settingsRedirect(req, provider, false, "Missing saved OAuth state");
  }

  let parsedState: { state?: string; createdAt?: string } = {};
  try {
    parsedState = JSON.parse(savedState.value) as { state?: string; createdAt?: string };
  } catch {
    parsedState = {};
  }

  const createdAtMs = parsedState.createdAt ? new Date(parsedState.createdAt).getTime() : NaN;
  const isFresh = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 1000 * 60 * 20;

  if (parsedState.state !== state || !isFresh) {
    return settingsRedirect(req, provider, false, "Invalid or expired OAuth state");
  }

  const redirectUri = `${appBaseUrl(req)}/api/pos/callback/${provider}`;

  try {
    const credentials = await adapter.exchangeCode(code, redirectUri);

    await prisma.setting.upsert({
      where: { key: credentialsKey(provider) },
      create: { key: credentialsKey(provider), value: JSON.stringify(credentials) },
      update: { value: JSON.stringify(credentials) },
    });

    await prisma.setting.upsert({
      where: { key: "pos_connected_provider" },
      create: { key: "pos_connected_provider", value: provider },
      update: { value: provider },
    });

    await prisma.setting.upsert({
      where: { key: "pos_sync_error" },
      create: { key: "pos_sync_error", value: "" },
      update: { value: "" },
    });

    await prisma.setting.deleteMany({ where: { key: stateKey(provider) } });

    return settingsRedirect(req, provider, true);
  } catch (error) {
    return settingsRedirect(
      req,
      provider,
      false,
      error instanceof Error ? error.message : "Failed to connect provider",
    );
  }
}
