import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAppUrlFromRequest } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { getPosAdapter, getAvailableProviders, isPosProvider, type PosProvider } from "@/lib/pos";

export const runtime = "nodejs";

function stateKey(provider: PosProvider) {
  return `pos_oauth_state_${provider}`;
}

function appBaseUrl(req: NextRequest) {
  return getAppUrlFromRequest(req);
}

function providerIsAvailable(provider: PosProvider) {
  return getAvailableProviders().some((adapter) => adapter.provider === provider);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider: providerRaw } = await params;
  if (!isPosProvider(providerRaw) || !providerIsAvailable(providerRaw)) {
    return NextResponse.json({ error: "Unsupported POS provider" }, { status: 400 });
  }

  const provider = providerRaw as PosProvider;
  const adapter = getPosAdapter(provider);
  const action = req.nextUrl.searchParams.get("action") || "connect";
  if (action !== "connect") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const state = randomUUID();
  const redirectUri = `${appBaseUrl(req)}/api/pos/callback/${provider}`;
  const authUrl = adapter.getAuthUrl(redirectUri, state);

  if (!authUrl) {
    return NextResponse.json(
      {
        error: `${adapter.displayName} is not available yet for this account`,
      },
      { status: 400 },
    );
  }

  await prisma.setting.upsert({
    where: { key: stateKey(provider) },
    create: {
      key: stateKey(provider),
      value: JSON.stringify({ state, createdAt: new Date().toISOString() }),
    },
    update: {
      value: JSON.stringify({ state, createdAt: new Date().toISOString() }),
    },
  });

  return NextResponse.redirect(authUrl);
}
