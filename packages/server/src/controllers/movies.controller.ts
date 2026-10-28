import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  movieRepository,
  aiEnrichmentRepository,
} from "@repo/database";
import { notionSyncService } from "../services/notion-sync.service";
import { geminiEnricherService } from "../services/gemini-enricher.service";

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  year: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const syncBodySchema = z.object({
  forceFullSync: z.boolean().optional(),
});

const enrichMovieSchema = z.object({
  force: z.boolean().optional(),
  model: z.string().optional(),
  syncToNotion: z.boolean().optional(),
});

const legacyEnrichBodySchema = z.object({
  movieId: z.string().min(1),
  force: z.boolean().optional(),
  model: z.string().optional(),
  syncToNotion: z.boolean().optional(),
});

export const moviesController = new Hono()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const { status, search, year, limit, offset } = c.req.valid("query");

    const { items, total } = await movieRepository.list({
      status,
      search,
      year,
      limit,
      offset,
    });

    const movieIds = items.map((movie) => movie.id);
    const enrichmentMap = await aiEnrichmentRepository.findManyByTargets("MOVIE", movieIds);

    const itemsWithEnrichment = items.map((movie) => {
      let parsedGenres: string[] = [];
      try {
        parsedGenres = JSON.parse(movie.genres || "[]");
      } catch {
        parsedGenres = [];
      }

      const enrichment = enrichmentMap.get(movie.id) || null;

      return {
        ...movie,
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
    let movie = await movieRepository.findById(id);

    if (!movie) {
      movie = await movieRepository.findByCleanTitle(id);
    }

    if (!movie) {
      return c.json(
        {
          success: false,
          error: `Película con ID o slug '${id}' no encontrada`,
        },
        404
      );
    }

    const enrichment = await geminiEnricherService.getEnrichment("MOVIE", movie.id);
    if (!enrichment) {
      return c.json(
        {
          success: false,
          error: `Enriquecimiento IA no encontrado para la película '${movie.title}'`,
        },
        404
      );
    }

    return c.json({
      success: true,
      data: enrichment,
    });
  })
  .post("/:id/enrich", zValidator("json", enrichMovieSchema.optional()), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json") || {};

    try {
      const result = await geminiEnricherService.enrichMovie(id, body);
      return c.json({
        success: true,
        data: {
          movieId: result.movie.id,
          title: result.movie.title,
          enrichment: result.enrichment,
          cached: result.cached,
        },
      });
    } catch (err: any) {
      const isNotFound = err.message?.includes("no encontrada");
      return c.json(
        {
          success: false,
          error: err.message || "Error al enriquecer película con Gemini IA",
        },
        isNotFound ? 404 : 500
      );
    }
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    let movie = await movieRepository.findById(id);

    if (!movie) {
      movie = await movieRepository.findByCleanTitle(id);
    }

    if (!movie) {
      return c.json(
        {
          success: false,
          error: `Película con ID o slug '${id}' no encontrada`,
        },
        404
      );
    }

    const enrichment = await aiEnrichmentRepository.getParsedEnrichment?.("MOVIE", movie.id) ?? null;
    let parsedGenres: string[] = [];
    try {
      parsedGenres = JSON.parse(movie.genres || "[]");
    } catch {
      parsedGenres = [];
    }

    return c.json({
      success: true,
      data: {
        ...movie,
        genres: parsedGenres,
        aiEnrichment: enrichment,
      },
    });
  })
  .post("/sync", zValidator("json", syncBodySchema.optional()), async (c) => {
    const body = c.req.valid("json") || {};
    const stats = await notionSyncService.syncMovies(body.forceFullSync);

    return c.json({
      success: true,
      data: stats,
    });
  })
  .post("/enrich", zValidator("json", legacyEnrichBodySchema), async (c) => {
    const body = c.req.valid("json");
    try {
      const result = await geminiEnricherService.enrichMovie(body.movieId, body);
      return c.json({
        success: true,
        data: {
          id: result.movie.id,
          tmdbId: result.movie.tmdbId,
          enriched: true,
          enrichment: result.enrichment,
          cached: result.cached,
        },
      });
    } catch (err: any) {
      const isNotFound = err.message?.includes("no encontrada");
      return c.json(
        {
          success: false,
          error: err.message || `Película con ID '${body.movieId}' no encontrada`,
        },
        isNotFound ? 404 : 500
      );
    }
  });
