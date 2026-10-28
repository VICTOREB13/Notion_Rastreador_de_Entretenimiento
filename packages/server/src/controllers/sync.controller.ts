import { Hono } from "hono";
import { steamToNotionSyncService } from "../services/steam-notion-sync.service";
import { notionMetadataEnricherService } from "../services/notion-metadata.service";

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
});
