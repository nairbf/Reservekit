import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/reservekit.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaults: Record<string, string> = {
    restaurantName: "The Reef Restaurant",
    timezone: "America/New_York",
    phone: "(555) 123-4567",
    address: "123 Harbor Drive, Coastal City, CA 90210",
    contactEmail: "hello@reef.restaurant",
    openTime: "17:00",
    closeTime: "22:00",
    slotInterval: "30",
    maxCoversPerSlot: "40",
    slug: "reef",
    heroImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
    logoUrl: "",
    faviconUrl: "",
    tagline: "Modern coastal cuisine in the heart of downtown",
    description: "At Reef, we celebrate the ocean's bounty with locally sourced ingredients and innovative preparations. Join us for an unforgettable dining experience.",
    accentColor: "#1e3a5f",
    announcementText: "",
    socialInstagram: "",
    socialFacebook: "",
    menu_files: "[]",
    diningDurations: JSON.stringify({
      1: 60, 2: 75, 3: 90, 4: 90, 5: 105, 6: 120, 7: 120, 8: 120,
    }),
    maxPartySize: "8",
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  const hash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@restaurant.com" },
    update: {},
    create: {
      email: "admin@restaurant.com",
      passwordHash: hash,
      name: "Admin",
      role: "admin",
    },
  });

  console.log("✅ Seeded: settings + admin user (admin@restaurant.com / admin123)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
