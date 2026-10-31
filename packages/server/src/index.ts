import { configurePragmas, prisma } from "@repo/database";
import { app } from "./app";
import { daemonScheduler } from "./daemon/scheduler";
import { config } from "./config";

export * from "./app";
export * from "./config";
export * from "./clients/notion.client";
export * from "./clients/steam.client";
export * from "./clients/gemini.client";
export * from "./services/notion-sync.service";
export * from "./services/steam-live.service";
export * from "./services/playtime-tracker.service";
export * from "./services/gemini-enricher.service";
export * from "./daemon/scheduler";

declare const Bun: any;

async function main() {
  console.log(`[Server] Initializing SQLite WAL pragmas...`);
  await configurePragmas();

  // Diagnóstico de variables de entorno al arranque
  console.log(`[Config Diagnostics] --------------------------------------------------`);
  console.log(`[Config] Notion Token: ${config.notionToken ? "Configurado (***)" : "FALTANTE ❌ (Coloca NOTION_TOKEN en tu .env)"}`);
  console.log(`[Config] Notion Games DB: ${config.notionDatabaseIdGames ? config.notionDatabaseIdGames : "FALTANTE ❌ (Coloca DB_ID_GAMES en tu .env)"}`);
  console.log(`[Config] Notion Movies DB: ${config.notionDatabaseIdMovies ? config.notionDatabaseIdMovies : "FALTANTE ❌ (Coloca DB_ID_MOVIES en tu .env)"}`);
  console.log(`[Config] Steam API Key: ${config.steamKey ? "Configurado (***)" : "Opcional (STEAM_KEY)"}`);
  console.log(`[Config] Steam User ID: ${config.steamUserId ? config.steamUserId : "Opcional (STEAM_USER_ID)"}`);
  console.log(`[Config] Gemini AI Key: ${config.geminiApiKey ? "Configurado (***)" : "Opcional (GEMINI_API_KEY)"}`);
  console.log(`[Config] Gemini Model: ${config.geminiDefaultModel}`);
  console.log(`[Config Diagnostics] --------------------------------------------------`);

  // Iniciar demonio de fondo
  daemonScheduler.start();

  console.log(`[Server] Starting Hono HTTP server on http://${config.host}:${config.port}`);

  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
    idleTimeout: 255, // Extiende el timeout para mantener vivos flujos SSE prolongados
  });

  const shutdown = async () => {
    console.log("[Server] Gracefully shutting down...");
    daemonScheduler.stop();
    server.stop();
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Ejecutar solo si este archivo se ejecuta directamente como script
if (import.meta.main) {
  main().catch((err) => {
    console.error("[Server] Fatal bootstrap error:", err);
    process.exit(1);
  });
}
