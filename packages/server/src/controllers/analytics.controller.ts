import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  prisma,
  sessionRepository,
  dailyPlaytimeRepository,
} from "@repo/database";
import { playtimeTrackerService } from "../services/playtime-tracker.service";

const analyticsQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

export const analyticsController = new Hono()
  .get("/", zValidator("query", analyticsQuerySchema), async (c) => {
    const { days } = c.req.valid("query");

    const [
      totalGames,
      completedGames,
      playtimeAggregate,
      topGamesRaw,
      gamesGenres,
      totalMovies,
      watchedMovies,
      moviesGenres,
      timeSeries,
      recentSessionsRaw,
    ] = await Promise.all([
      prisma.game.count(),
      prisma.game.count({ where: { status: "Jugado" } }),
      prisma.game.aggregate({
        _sum: { playtimeForever: true },
      }),
      prisma.game.findMany({
        take: 5,
        orderBy: { playtimeForever: "desc" },
        select: {
          id: true,
          title: true,
          playtimeForever: true,
          coverUrl: true,
        },
      }),
      prisma.game.findMany({
        select: { genres: true },
      }),
      prisma.movie.count(),
      prisma.movie.count({ where: { status: "Vista" } }),
      prisma.movie.findMany({
        select: { genres: true },
      }),
      dailyPlaytimeRepository.getTimeSeries(days),
      sessionRepository.getRecentSessions(10),
    ]);

    // Calcular horas totales acumuladas
    const totalPlaytimeHours = Number(
      (playtimeAggregate._sum.playtimeForever ?? 0).toFixed(1)
    );

    const completionRate =
      totalGames > 0 ? Number(((completedGames / totalGames) * 100).toFixed(2)) : 0;

    // Métricas de cinefilia
    const estimatedWatchTimeHours = Number((watchedMovies * 2.0).toFixed(1));
    const movieCompletionRate =
      totalMovies > 0 ? Number(((watchedMovies / totalMovies) * 100).toFixed(2)) : 0;

    // Calcular racha de juego
    const currentStreakDays = playtimeTrackerService.calculateStreak(timeSeries);

    // Sesiones recientes mapeadas
    const recentSessions = recentSessionsRaw.map((s) => ({
      id: s.id,
      gameTitle: s.game.title,
      coverUrl: s.game.coverUrl,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt ? s.endedAt.toISOString() : null,
      durationMinutes: s.durationMinutes,
      isLive: s.isLive,
    }));

    // Top 5 juegos
    const topGames = topGamesRaw.map((g) => ({
      id: g.id,
      title: g.title,
      hours: g.playtimeForever,
      coverUrl: g.coverUrl,
    }));

    // Distribución unificada de géneros (Videojuegos + Películas)
    const genreMap = new Map<string, number>();
    const allGenresSources = [...gamesGenres, ...moviesGenres];
    for (const item of allGenresSources) {
      let parsedGenres: string[] = [];
      try {
        const raw = JSON.parse(item.genres || "[]");
        parsedGenres = Array.isArray(raw) ? raw : [String(raw)];
      } catch {
        parsedGenres = (item.genres || "").split(",").map((s) => s.trim()).filter(Boolean);
      }
      for (const genre of parsedGenres) {
        const cleanGenre = String(genre).trim();
        if (cleanGenre) {
          const current = genreMap.get(cleanGenre) ?? 0;
          genreMap.set(cleanGenre, current + 1);
        }
      }
    }

    const genreDistribution = Array.from(genreMap.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return c.json({
      success: true,
      data: {
        summary: {
          totalGames,
          totalPlaytimeHours,
          completedGames,
          completionRate,
          totalMovies,
          watchedMovies,
          estimatedWatchTimeHours,
          movieCompletionRate,
          currentStreakDays,
        },
        recentSessions,
        timeSeries,
        topGames,
        genreDistribution,
      },
    });
  });
