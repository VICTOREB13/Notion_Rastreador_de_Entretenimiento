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
  limit: z.coerce.number().min(1).max(500).default(200),
  offset: z.coerce.number().min(0).default(0),
  all: z.coerce.boolean().optional(),
});

const syncBodySchema = z.object({
  forceFullSync: z.boolean().optional(),
});

const enrichGameSchema = z.object({
  force: z.boolean().optional(),
  model: z.string().optional(),
  syncToNotion: z.boolean().optional(),
});

function formatGameDto(game: any, enrichment: any) {
  const parse = (v?: string | null): string[] => {
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v || "[]"); } catch { return []; }
  };
  const parsedGenres = parse(game.genres);
  const parsedNotionGenres = parse(game.notionGenres);
  return {
    ...game,
    genres: parsedGenres,
    notionGenres: parsedNotionGenres.length > 0 ? parsedNotionGenres : parsedGenres,
    rating: game.rating ?? null,
    completedAt: game.completedAt ?? game.completionDate ?? null,
    completionDate: game.completionDate ?? game.completedAt ?? null,
    userNotes: game.userNotes ?? game.personalSummary ?? game.summary ?? null,
    personalSummary: game.personalSummary ?? game.userNotes ?? game.summary ?? null,
    summary: game.summary ?? game.personalSummary ?? game.userNotes ?? null,
    aiEnrichment: enrichment,
  };
}

export const gamesController = new Hono()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const { status, search, limit, offset, all } = c.req.valid("query");

    const { items, total } = await gameRepository.list({
      status,
      search,
      limit,
      offset,
      all,
    });

    const gameIds = items.map((game) => game.id);
    const enrichmentMap = await aiEnrichmentRepository.findManyByTargets("GAME", gameIds);

    const itemsWithEnrichment = items.map((game) =>
      formatGameDto(game, enrichmentMap.get(game.id) || null)
    );

    return c.json({
      success: true,
      data: itemsWithEnrichment,
      pagination: {
        total,
        limit: all ? total : limit,
        offset: all ? 0 : offset,
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

    const enrichment = (await aiEnrichmentRepository.getParsedEnrichment?.("GAME", game.id)) ?? null;
    return c.json({
      success: true,
      data: formatGameDto(game, enrichment),
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
