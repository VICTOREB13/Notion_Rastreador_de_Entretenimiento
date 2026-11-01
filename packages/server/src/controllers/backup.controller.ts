import { Hono } from "hono";
import { prisma } from "@repo/database";

export const backupController = new Hono()
  .get("/export", async (c) => {
    try {
      const [games, movies, gameSessions, dailyPlaytime, aiEnrichments, aiSettings] =
        await Promise.all([
          prisma.game.findMany(),
          prisma.movie.findMany(),
          prisma.gameSession.findMany(),
          prisma.dailyPlaytime.findMany(),
          prisma.aiEnrichment.findMany(),
          prisma.aiSettings.findMany(),
        ]);

      // Enmascarar credenciales sensibles de IA en la exportación por seguridad
      const sanitizedAiSettings = aiSettings.map((s) => ({
        ...s,
        geminiApiKey: s.geminiApiKey ? "***" : null,
        deepseekApiKey: s.deepseekApiKey ? "***" : null,
        groqApiKey: s.groqApiKey ? "***" : null,
      }));

      const backupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        counts: {
          games: games.length,
          movies: movies.length,
          gameSessions: gameSessions.length,
          dailyPlaytime: dailyPlaytime.length,
          aiEnrichments: aiEnrichments.length,
          aiSettings: sanitizedAiSettings.length,
        },
        data: {
          games,
          movies,
          gameSessions,
          dailyPlaytime,
          aiEnrichments,
          aiSettings: sanitizedAiSettings,
        },
      };

      return new Response(JSON.stringify(backupData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="notion-entertainment-backup.json"',
        },
      });
    } catch (err: any) {
      return c.json(
        {
          success: false,
          error: `Error al generar respaldo de base de datos: ${err.message}`,
        },
        500
      );
    }
  });
