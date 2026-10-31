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
import { config } from "../config";

export interface EnrichOptions {
  force?: boolean;
  model?: string;
  /**
   * @deprecated Directiva arquitectónica estricta: los datos de IA se guardan
   * EXCLUSIVAMENTE en SQLite local y se muestran en la web. Notion jamás se modifica.
   * Este parámetro se ignora para evitar errores 400 y consumo innecesario de cuota.
   */
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
    private _notion?: INotionSyncClient
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

    // NOTA ARQUITECTÓNICA: Los datos de enriquecimiento IA se persisten EXCLUSIVAMENTE
    // en la base de datos local SQLite y se sirven a la web. Notion JAMÁS debe ser alterado
    // ni contaminado con columnas o propiedades de IA ("Vibe IA", "Pitch IA").

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

    // NOTA ARQUITECTÓNICA: Los datos de enriquecimiento IA se persisten EXCLUSIVAMENTE
    // en la base de datos local SQLite y se sirven a la web. Notion JAMÁS debe ser alterado
    // ni contaminado con columnas o propiedades de IA ("Vibe IA", "Pitch IA").

    return {
      movie,
      enrichment,
      cached: false,
    };
  }

  /**
   * NO-OP intencional por directiva arquitectónica:
   * Los datos de enriquecimiento de IA (vibeTags, personalizedPitch, thematicTropes, completionEstimateWeeks)
   * se almacenan EXCLUSIVAMENTE en SQLite local y se sirven en la interfaz web.
   * Notion jamás debe ser alterado ni contaminado con columnas de IA ("Vibe IA", "Pitch IA").
   */
  async syncEnrichmentToNotion(
    _notionPageId?: string,
    _enrichment?: AiEnrichmentResult
  ): Promise<void> {
    // Deliberate no-op: jamás alterar Notion con propiedades de IA
  }

  /**
   * Alias NO-OP intencional por directiva arquitectónica para syncToNotion.
   */
  async syncToNotion(
    _notionPageId?: string,
    _enrichment?: AiEnrichmentResult
  ): Promise<void> {
    // Deliberate no-op: jamás alterar Notion con propiedades de IA
  }
}

export const geminiEnricherService = new GeminiEnricherService();
