import { LicenseEventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface LicenseEventInput {
  restaurantId: string;
  event: LicenseEventType;
  details?: string | null;
  performedBy?: string | null;
}

export async function createLicenseEvent(input: LicenseEventInput) {
  return prisma.licenseEvent.create({
    data: {
      restaurantId: input.restaurantId,
      event: input.event,
      details: input.details || null,
      performedBy: input.performedBy || null,
    },
  });
}

export async function createLicenseEvents(inputs: LicenseEventInput[]) {
  if (inputs.length === 0) return [];
  const created = [];
  for (const input of inputs) {
    created.push(await createLicenseEvent(input));
  }
  return created;
}
