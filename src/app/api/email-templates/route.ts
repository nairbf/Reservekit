import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getAllTemplates, getTemplate, type TemplateData } from "@/lib/email-templates";

function normalizeTemplatePatch(input: Record<string, unknown>): Partial<TemplateData> {
  const out: Partial<TemplateData> = {};
  const fields: Array<keyof TemplateData> = ["subject", "heading", "body", "ctaText", "ctaUrl", "footerText"];
  for (const field of fields) {
    if (typeof input[field] === "string") {
      out[field] = input[field] as string;
    }
  }
  return out;
}

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await getAllTemplates();
  return NextResponse.json({ templates });
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const templateId = String(body.templateId || "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const key = `email_template_${templateId}`;
  if (body.reset === true) {
    await prisma.setting.deleteMany({ where: { key } });
    const template = await getTemplate(templateId);
    return NextResponse.json({ template: { ...template, id: templateId, customized: false } });
  }

  const current = await getTemplate(templateId);
  const patch = normalizeTemplatePatch(body);
  const next = { ...current, ...patch };

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });

  return NextResponse.json({ template: { ...next, id: templateId, customized: true } });
}
