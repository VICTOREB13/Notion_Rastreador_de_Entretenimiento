import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./data/entertainment.db";
}

/**
 * Defensa en profundidad: asegura que el directorio de la base de datos SQLite exista
 * antes de instanciar PrismaClient o ejecutar operaciones en disco.
 */
export function ensureDatabaseDirectory(url: string | undefined = process.env.DATABASE_URL): void {
  if (!url || !url.startsWith("file:")) return;
  let rawPath = url.replace(/^file:/, "").split("?")[0];
  if (!rawPath || rawPath.startsWith(":memory:")) return;

  // Normalizar file:///C:/path en Windows y file:///app/data en POSIX
  if (/^\/{1,3}[a-zA-Z]:/.test(rawPath)) {
    rawPath = rawPath.replace(/^\/{1,3}/, "");
  } else if (/^\/{3,}/.test(rawPath)) {
    rawPath = rawPath.replace(/^\/{2}/, "");
  }

  const dbDir = path.dirname(rawPath);
  if (dbDir && dbDir !== "." && dbDir !== "") {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch {
      // Ignorar si el directorio ya existe o no se puede crear en este entorno
    }
  }
}

// Asegurar existencia del directorio previo a instanciar PrismaClient
ensureDatabaseDirectory(process.env.DATABASE_URL);

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
