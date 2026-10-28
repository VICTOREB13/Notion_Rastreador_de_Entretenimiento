import { configurePragmas } from "@repo/database";
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

  // Iniciar demonio de fondo
  daemonScheduler.start();

  console.log(`[Server] Starting Hono HTTP server on http://${config.host}:${config.port}`);

  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
  });

  const shutdown = () => {
    console.log("[Server] Gracefully shutting down...");
    daemonScheduler.stop();
    server.stop();
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
