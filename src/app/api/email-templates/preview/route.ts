import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getTemplate,
  getSampleVariables,
  renderTemplate,
  type TemplateData,
} from "@/lib/email-templates";

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

export async function POST(req: NextRequest) {
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

  const base = await getTemplate(templateId);
  const patch = normalizeTemplatePatch(body);
  const template = { ...base, ...patch };

  const variableOverrides =
    body.variables && typeof body.variables === "object"
      ? (body.variables as Record<string, unknown>)
      : {};

  const variables = getSampleVariables(
    Object.fromEntries(
      Object.entries(variableOverrides)
        .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
        .map(([key, value]) => [key, String(value)]),
    ),
  );

  const rendered = renderTemplate(template, variables);
  return NextResponse.json({ subject: rendered.subject, html: rendered.html, variables });
}
