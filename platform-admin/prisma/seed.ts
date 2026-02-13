import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, PlatformRole, RestaurantPlan, RestaurantStatus, LicenseEventType, HostingStatus } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/platform-admin.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.platformUser.upsert({
    where: { email: "admin@reservesit.com" },
    update: {
      name: "Platform Admin",
      role: PlatformRole.SUPER_ADMIN,
      password: passwordHash,
    },
    create: {
      email: "admin@reservesit.com",
      name: "Platform Admin",
      role: PlatformRole.SUPER_ADMIN,
      password: passwordHash,
    },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "reef" },
    update: {
      name: "The Reef Restaurant",
      adminEmail: "owner@reef.com",
      ownerName: "Reef Owner",
      ownerEmail: "owner@reef.com",
      ownerPhone: "(555) 123-4567",
      domain: "reef.reservesit.com",
      status: RestaurantStatus.ACTIVE,
      plan: RestaurantPlan.CORE,
      port: 3001,
      dbPath: "/home/reservesit/customers/reef/reservekit.db",
      hostingStatus: HostingStatus.ACTIVE,
      hosted: true,
      addonSms: false,
      addonFloorPlan: false,
      addonReporting: false,
      addonGuestHistory: false,
      addonEventTicketing: false,
    },
    create: {
      slug: "reef",
      name: "The Reef Restaurant",
      adminEmail: "owner@reef.com",
      ownerName: "Reef Owner",
      ownerEmail: "owner@reef.com",
      ownerPhone: "(555) 123-4567",
      domain: "reef.reservesit.com",
      status: RestaurantStatus.ACTIVE,
      plan: RestaurantPlan.CORE,
      port: 3001,
      dbPath: "/home/reservesit/customers/reef/reservekit.db",
      licenseKey: randomUUID(),
      hosted: true,
      hostingStatus: HostingStatus.ACTIVE,
      monthlyHostingActive: false,
      addonSms: false,
      addonFloorPlan: false,
      addonReporting: false,
      addonGuestHistory: false,
      addonEventTicketing: false,
    },
  });

  const createdEvent = await prisma.licenseEvent.findFirst({
    where: { restaurantId: restaurant.id, event: LicenseEventType.LICENSE_CREATED },
  });

  if (!createdEvent) {
    await prisma.licenseEvent.create({
      data: {
        restaurantId: restaurant.id,
        event: LicenseEventType.LICENSE_CREATED,
        details: "Seeded sample restaurant",
        performedBy: "seed",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
