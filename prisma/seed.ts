import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/reservekit.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaults: Record<string, string> = {
    restaurantName: "My Restaurant",
    timezone: "America/New_York",
    phone: "",
    address: "",
    openTime: "17:00",
    closeTime: "22:00",
    slotInterval: "30",
    maxCoversPerSlot: "40",
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
