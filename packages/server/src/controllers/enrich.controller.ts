import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "@repo/database";
import { geminiEnricherService } from "../services/gemini-enricher.service";
import { broadcastEvent } from "./events.controller";

const batchEnrichSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  delayMs: z.coerce.number().min(0).max(5000).default(1000),
  targetType: z.enum(["ALL", "GAME", "MOVIE"]).default("ALL"),
  force: z.boolean().default(false),
  model: z.string().optional(),
});

export const enrichController = new Hono()
  .post("/batch", zValidator("json", batchEnrichSchema.optional()), async (c) => {
    const { limit = 10, delayMs = 1000, targetType = "ALL", force = false, model } =
      c.req.valid("json") || {};

    // Obtener enriquecimientos existentes si no se fuerza re-evaluación
    const existingEnrichments = !force
      ? await prisma.aiEnrichment.findMany({ select: { targetType: true, targetId: true } })
      : [];
    const enrichedGameIds = new Set(
      existingEnrichments.filter((e) => e.targetType === "GAME").map((e) => e.targetId)
    );
    const enrichedMovieIds = new Set(
      existingEnrichments.filter((e) => e.targetType === "MOVIE").map((e) => e.targetId)
    );

    const candidates: Array<{ id: string; title: string; type: "GAME" | "MOVIE" }> = [];

    if (targetType === "GAME") {
      const games = await prisma.game.findMany({
        where: force ? {} : { id: { notIn: Array.from(enrichedGameIds) } },
        select: { id: true, title: true },
        take: limit,
      });
      for (const g of games) {
        candidates.push({ id: g.id, title: g.title, type: "GAME" });
      }
    } else if (targetType === "MOVIE") {
      const movies = await prisma.movie.findMany({
        where: force ? {} : { id: { notIn: Array.from(enrichedMovieIds) } },
        select: { id: true, title: true },
        take: limit,
      });
      for (const m of movies) {
        candidates.push({ id: m.id, title: m.title, type: "MOVIE" });
      }
    } else {
      // targetType === "ALL": balancear equitativamente entre videojuegos y cine
      const initialGameLimit = Math.ceil(limit / 2);
      const games = await prisma.game.findMany({
        where: force ? {} : { id: { notIn: Array.from(enrichedGameIds) } },
        select: { id: true, title: true },
        take: initialGameLimit,
      });
      for (const g of games) {
        candidates.push({ id: g.id, title: g.title, type: "GAME" });
      }

      const movieLimit = limit - candidates.length;
      if (movieLimit > 0) {
        const movies = await prisma.movie.findMany({
          where: force ? {} : { id: { notIn: Array.from(enrichedMovieIds) } },
          select: { id: true, title: true },
          take: movieLimit,
        });
        for (const m of movies) {
          candidates.push({ id: m.id, title: m.title, type: "MOVIE" });
        }
      }

      // Si quedaron cupos disponibles por falta de películas, rellenar con juegos restantes
      const remainingLimit = limit - candidates.length;
      if (remainingLimit > 0 && games.length === initialGameLimit) {
        const existingCandidateIds = new Set(candidates.map((c) => c.id));
        const extraGames = await prisma.game.findMany({
          where: force
            ? { id: { notIn: Array.from(existingCandidateIds) } }
            : { id: { notIn: [...Array.from(enrichedGameIds), ...Array.from(existingCandidateIds)] } },
          select: { id: true, title: true },
          take: remainingLimit,
        });
        for (const g of extraGames) {
          candidates.push({ id: g.id, title: g.title, type: "GAME" });
        }
      }
    }

    let successCount = 0;
    let errorCount = 0;
    const details: Array<{
      id: string;
      title: string;
      type: "GAME" | "MOVIE";
      success: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      try {
        if (item.type === "GAME") {
          await geminiEnricherService.enrichGame(item.id, { force, model });
        } else {
          await geminiEnricherService.enrichMovie(item.id, { force, model });
        }
        successCount++;
        details.push({ id: item.id, title: item.title, type: item.type, success: true });

        broadcastEvent("enrichment_progress", {
          processed: i + 1,
          total: candidates.length,
          currentTitle: item.title,
          type: item.type,
          status: "success",
        });
      } catch (err: any) {
        errorCount++;
        details.push({
          id: item.id,
          title: item.title,
          type: item.type,
          success: false,
          error: err.message,
        });

        broadcastEvent("enrichment_progress", {
          processed: i + 1,
          total: candidates.length,
          currentTitle: item.title,
          type: item.type,
          status: "error",
          error: err.message,
        });
      }

      // Delay entre llamadas para respetar cuotas de Gemini free tier
      if (delayMs > 0 && i < candidates.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (successCount > 0) {
      broadcastEvent("catalog_updated", { entity: "all", action: "batch_enrich" });
    }

    return c.json({
      success: true,
      data: {
        totalPending: candidates.length,
        processed: candidates.length,
        success: successCount,
        errors: errorCount,
        details,
      },
    });
  });
