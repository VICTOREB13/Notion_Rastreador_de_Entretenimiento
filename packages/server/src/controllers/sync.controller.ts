import { Hono } from "hono";
import { steamToNotionSyncService } from "../services/steam-notion-sync.service";
import { notionMetadataEnricherService } from "../services/notion-metadata.service";
import { notionSyncService } from "../services/notion-sync.service";
import { broadcastEvent } from "./events.controller";

export const syncController = new Hono()
  .post("/trigger", async (c) => {
    try {
      const gameStats = await steamToNotionSyncService.syncSteamToNotion();
      const movieStats = await notionMetadataEnricherService.enrichMovies();

      return c.json({
        success: true,
        message: "Sincronización manual completada con éxito.",
        data: {
          games: gameStats,
          movies: movieStats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("[SyncController] Error ejecutando sincronización manual:", error);
      return c.json(
        {
          success: false,
          error: {
            message: error?.message || "Error al ejecutar la sincronización manual.",
          },
        },
        500
      );
    }
  })
  .post("/notion", async (c) => {
    try {
      const gameStats = await notionSyncService.syncGames();
      const movieStats = await notionSyncService.syncMovies();

      broadcastEvent("catalog_updated", {
        source: "notion_sync",
        games: gameStats,
        movies: movieStats,
      });

      return c.json({
        success: true,
        message: "Sincronización Notion ➔ App completada con éxito.",
        data: {
          games: gameStats,
          movies: movieStats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("[SyncController] Error ejecutando sincronización Notion:", error);
      return c.json(
        {
          success: false,
          error: {
            message: error?.message || "Error al sincronizar con Notion.",
          },
        },
        500
      );
    }
  });

