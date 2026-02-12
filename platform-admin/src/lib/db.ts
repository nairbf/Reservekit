import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  adapter?: PrismaBetterSqlite3;
};

const adapter =
  globalForPrisma.adapter ??
  new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./prisma/platform-admin.db",
  });

if (!globalForPrisma.adapter) globalForPrisma.adapter = adapter;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
