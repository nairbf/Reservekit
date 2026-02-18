import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { HostingStatus, PrismaClient, RestaurantPlan, RestaurantStatus } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/platform-admin.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const reef = await prisma.restaurant.findFirst({ where: { slug: "reef" } });
  if (!reef) {
    console.log("Reef not found");
    return;
  }

  await prisma.restaurant.update({
    where: { id: reef.id },
    data: {
      plan: RestaurantPlan.FULL_SUITE,
      status: RestaurantStatus.ACTIVE,
      oneTimeRevenue: 0,
      monthlyHostingActive: false,
      hosted: true,
      hostingStatus: HostingStatus.ACTIVE,
      notes: "Test client - Full Suite gifted, no charge",
    },
  });

  console.log("Reef updated: Full Suite, $0 revenue, active");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
