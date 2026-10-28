import type {
  IGameRepository,
  IMovieRepository,
  IAiEnrichmentRepository,
  IAiSettingsRepository,
  INotionSyncClient,
  AiPromptPayload,
  AiEnrichmentResult,
  Game,
  Movie,
} from "@repo/database";
import {
  gameRepository,
  movieRepository,
  aiEnrichmentRepository,
  aiSettingsRepository,
} from "@repo/database";
import { GeminiClient, geminiClient } from "../clients/gemini.client";
import { NotionClient, notionClient } from "../clients/notion.client";
import { config } from "../config";

export interface EnrichOptions {
  force?: boolean;
  model?: string;
  syncToNotion?: boolean;
}

export interface EnrichedGameResult {
  game: Game;
  enrichment: AiEnrichmentResult;
  cached: boolean;
}

export interface EnrichedMovieResult {
  movie: Movie;
  enrichment: AiEnrichmentResult;
  cached: boolean;
}

export class GeminiEnricherService {
  constructor(
    private client: GeminiClient = geminiClient,
    private gameRepo: IGameRepository = gameRepository,
    private movieRepo: IMovieRepository = movieRepository,
    private enrichmentRepo: IAiEnrichmentRepository = aiEnrichmentRepository,
    private settingsRepo: IAiSettingsRepository = aiSettingsRepository,
    private notion: INotionSyncClient = notionClient
  ) {}

  private async resolveSettings(modelOverride?: string): Promise<{
    apiKey?: string;
    model: string;
    temperature: number;
  }> {
    const settings = await this.settingsRepo.getSettings();
    const apiKey = settings.geminiApiKey || config.geminiApiKey || undefined;
    const model = modelOverride || settings.selectedModel || config.geminiDefaultModel || "gemini-2.5-flash";
    const temperature = typeof settings.temperature === "number" ? settings.temperature : 0.7;

    return { apiKey, model, temperature };
  }

  async getEnrichment(targetType: "GAME" | "MOVIE", targetId: string): Promise<AiEnrichmentResult | null> {
    const raw = await this.enrichmentRepo.findByTarget(targetType, targetId);
    if (!raw) return null;

    let vibeTags: string[] = [];
    let thematicTropes: string[] = [];
    try {
      vibeTags = JSON.parse(raw.vibeTags || "[]");
    } catch {
      vibeTags = [];
    }
    try {
      thematicTropes = JSON.parse(raw.thematicTropes || "[]");
    } catch {
      thematicTropes = [];
    }

    return {
      vibeTags,
      personalizedPitch: raw.personalizedPitch,
      thematicTropes,
      completionEstimateWeeks: raw.completionEstimateWeeks ?? undefined,
      rawResponse: raw.rawResponse ?? undefined,
    };
  }

  async enrichGame(
    idOrCleanTitle: string,
    options?: EnrichOptions
  ): Promise<EnrichedGameResult> {
    let game = await this.gameRepo.findById(idOrCleanTitle);
    if (!game) {
      game = await this.gameRepo.findByCleanTitle(idOrCleanTitle);
    }
    if (!game) {
      throw new Error(`Videojuego con ID o slug '${idOrCleanTitle}' no encontrado`);
    }

    // Si no se fuerza re-análisis, verificar caché en SQLite
    if (!options?.force) {
      const cached = await this.getEnrichment("GAME", game.id);
      if (cached) {
        return {
          game,
          enrichment: cached,
          cached: true,
        };
      }
    }

    const { apiKey, model, temperature } = await this.resolveSettings(options?.model);

    let parsedGenres: string[] = [];
    try {
      parsedGenres = JSON.parse(game.genres || "[]");
    } catch {
      parsedGenres = [];
    }

    let playtimeOrDuration = `Horas jugadas: ${game.playtimeForever.toFixed(1)}h`;
    if (game.hltbMain) {
      playtimeOrDuration += `, HLTB Historia Principal: ${game.hltbMain}h`;
    }
    if (game.hltbCompletionist) {
      playtimeOrDuration += `, HLTB 100% Completista: ${game.hltbCompletionist}h`;
    }

    const payload: AiPromptPayload = {
      title: game.title,
      type: "GAME",
      genres: parsedGenres,
      playtimeOrDuration,
      userContext: `Estado en colección: ${game.status}, Plataforma: ${game.platform}`,
    };

    const enrichment = await this.client.generateEnrichment(payload, model, apiKey, temperature);

    // Persistir en SQLite (AiEnrichment)
    await this.enrichmentRepo.upsert({
      targetType: "GAME",
      targetId: game.id,
      vibeTags: JSON.stringify(enrichment.vibeTags),
      personalizedPitch: enrichment.personalizedPitch,
      thematicTropes: JSON.stringify(enrichment.thematicTropes),
      completionEstimateWeeks: enrichment.completionEstimateWeeks ?? null,
      provider: "gemini",
      modelUsed: model,
      rawResponse: enrichment.rawResponse ?? null,
    });

    // Sincronización opcional / no bloqueante hacia Notion
    if (options?.syncToNotion !== false && game.notionPageId) {
      await this.syncEnrichmentToNotion(game.notionPageId, enrichment);
    }

    return {
      game,
      enrichment,
      cached: false,
    };
  }

  async enrichMovie(
    idOrCleanTitle: string,
    options?: EnrichOptions
  ): Promise<EnrichedMovieResult> {
    let movie = await this.movieRepo.findById(idOrCleanTitle);
    if (!movie) {
      movie = await this.movieRepo.findByCleanTitle(idOrCleanTitle);
    }
    if (!movie) {
      throw new Error(`Película con ID o slug '${idOrCleanTitle}' no encontrada`);
    }

    // Si no se fuerza re-análisis, verificar caché en SQLite
    if (!options?.force) {
      const cached = await this.getEnrichment("MOVIE", movie.id);
      if (cached) {
        return {
          movie,
          enrichment: cached,
          cached: true,
        };
      }
    }

    const { apiKey, model, temperature } = await this.resolveSettings(options?.model);

    let parsedGenres: string[] = [];
    try {
      parsedGenres = JSON.parse(movie.genres || "[]");
    } catch {
      parsedGenres = [];
    }

    const payload: AiPromptPayload = {
      title: movie.title,
      type: "MOVIE",
      overview: movie.overview ?? undefined,
      genres: parsedGenres,
      playtimeOrDuration: movie.year ? `Año de estreno: ${movie.year}` : undefined,
      userContext: `Estado en colección: ${movie.status}`,
    };

    const enrichment = await this.client.generateEnrichment(payload, model, apiKey, temperature);

    // Persistir en SQLite (AiEnrichment)
    await this.enrichmentRepo.upsert({
      targetType: "MOVIE",
      targetId: movie.id,
      vibeTags: JSON.stringify(enrichment.vibeTags),
      personalizedPitch: enrichment.personalizedPitch,
      thematicTropes: JSON.stringify(enrichment.thematicTropes),
      completionEstimateWeeks: enrichment.completionEstimateWeeks ?? null,
      provider: "gemini",
      modelUsed: model,
      rawResponse: enrichment.rawResponse ?? null,
    });

    // Sincronización opcional hacia Notion
    if (options?.syncToNotion !== false && movie.notionPageId) {
      await this.syncEnrichmentToNotion(movie.notionPageId, enrichment);
    }

    return {
      movie,
      enrichment,
      cached: false,
    };
  }

  private async syncEnrichmentToNotion(
    notionPageId: string,
    enrichment: AiEnrichmentResult
  ): Promise<void> {
    const propsToUpdate: Record<string, unknown> = {};

    if (enrichment.vibeTags && enrichment.vibeTags.length > 0) {
      propsToUpdate["Vibe IA"] = {
        multi_select: enrichment.vibeTags.map((name) => ({ name })),
      };
    }

    if (enrichment.personalizedPitch) {
      propsToUpdate["Pitch IA"] = {
        rich_text: [
          {
            type: "text",
            text: { content: enrichment.personalizedPitch },
          },
        ],
      };
    }

    if (Object.keys(propsToUpdate).length === 0) return;

    try {
      await this.notion.updatePageProperties(notionPageId, propsToUpdate);
    } catch (err: any) {
      console.warn(
        `[GeminiEnricherService] Aviso: No se pudieron sincronizar propiedades de IA en página Notion ${notionPageId}:`,
        err?.message || err
      );
    }
  }
}

export const geminiEnricherService = new GeminiEnricherService();
