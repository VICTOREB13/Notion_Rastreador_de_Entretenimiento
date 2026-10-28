import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  gameRepository,
  aiEnrichmentRepository,
} from "@repo/database";
import { notionSyncService } from "../services/notion-sync.service";
import { geminiEnricherService } from "../services/gemini-enricher.service";
import { broadcastEvent } from "./events.controller";

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const syncBodySchema = z.object({
  forceFullSync: z.boolean().optional(),
});

const enrichGameSchema = z.object({
  force: z.boolean().optional(),
  model: z.string().optional(),
  syncToNotion: z.boolean().optional(),
});

export const gamesController = new Hono()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const { status, search, limit, offset } = c.req.valid("query");

    const { items, total } = await gameRepository.list({
      status,
      search,
      limit,
      offset,
    });

    const gameIds = items.map((game) => game.id);
    const enrichmentMap = await aiEnrichmentRepository.findManyByTargets("GAME", gameIds);

    const itemsWithEnrichment = items.map((game) => {
      let parsedGenres: string[] = [];
      try {
        parsedGenres = JSON.parse(game.genres || "[]");
      } catch {
        parsedGenres = [];
      }

      const enrichment = enrichmentMap.get(game.id) || null;

      return {
        ...game,
        genres: parsedGenres,
        aiEnrichment: enrichment,
      };
    });

    return c.json({
      success: true,
      data: itemsWithEnrichment,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  })
  .get("/:id/enrichment", async (c) => {
    const id = c.req.param("id");
    let game = await gameRepository.findById(id);

    if (!game) {
      game = await gameRepository.findByCleanTitle(id);
    }

    if (!game) {
      return c.json(
        {
          success: false,
          error: `Videojuego con ID o slug '${id}' no encontrado`,
        },
        404
      );
    }

    const enrichment = await geminiEnricherService.getEnrichment("GAME", game.id);
    if (!enrichment) {
      return c.json(
        {
          success: false,
          error: `Enriquecimiento IA no encontrado para el videojuego '${game.title}'`,
        },
        404
      );
    }

    return c.json({
      success: true,
      data: enrichment,
    });
  })
  .post("/:id/enrich", zValidator("json", enrichGameSchema.optional()), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json") || {};

    try {
      const result = await geminiEnricherService.enrichGame(id, body);
      broadcastEvent("catalog_updated", { entity: "games", action: "enrich", gameId: result.game.id });
      return c.json({
        success: true,
        data: {
          gameId: result.game.id,
          title: result.game.title,
          enrichment: result.enrichment,
          cached: result.cached,
        },
      });
    } catch (err: any) {
      const isNotFound = err.message?.includes("no encontrado");
      return c.json(
        {
          success: false,
          error: err.message || "Error al enriquecer videojuego con Gemini IA",
        },
        isNotFound ? 404 : 500
      );
    }
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    let game = await gameRepository.findById(id);

    if (!game) {
      game = await gameRepository.findByCleanTitle(id);
    }

    if (!game) {
      return c.json(
        {
          success: false,
          error: `Videojuego con ID o slug '${id}' no encontrado`,
        },
        404
      );
    }

    const enrichment = await aiEnrichmentRepository.getParsedEnrichment?.("GAME", game.id) ?? null;
    let parsedGenres: string[] = [];
    try {
      parsedGenres = JSON.parse(game.genres || "[]");
    } catch {
      parsedGenres = [];
    }

    return c.json({
      success: true,
      data: {
        ...game,
        genres: parsedGenres,
        aiEnrichment: enrichment,
      },
    });
  })
  .post("/sync", zValidator("json", syncBodySchema.optional()), async (c) => {
    const body = c.req.valid("json") || {};
    const stats = await notionSyncService.syncGames(body.forceFullSync);
    broadcastEvent("catalog_updated", { entity: "games", action: "sync", stats });

    return c.json({
      success: true,
      data: stats,
    });
  });
