import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./data/entertainment.db";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Aplica pragmas de SQLite para concurrencia, resiliencia y modo WAL.
 * - WAL (Write-Ahead Logging): Permite lecturas y escrituras simultáneas sin bloqueos.
 * - busy_timeout: Espera hasta 5000ms antes de retornar SQLITE_BUSY ante contención.
 * - synchronous = NORMAL: Reduce operaciones fsync sin comprometer integridad en WAL.
 * - foreign_keys = ON: Activa verificación estricta de claves foráneas a nivel motor.
 */
export async function configurePragmas(client: PrismaClient = prisma): Promise<void> {
  await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
  await client.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
}

export { PrismaClient };
export * from "@prisma/client";
