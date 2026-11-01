import type {
  INotionSyncClient,
  IGameRepository,
  IMovieRepository,
  NotionPageDelta,
} from "@repo/database";
import {
  gameRepository,
  movieRepository,
  cleanGameTitle,
} from "@repo/database";
import { NotionClient, notionClient } from "../clients/notion.client";
import { broadcastEvent } from "../controllers/events.controller";
import { config } from "../config";
import {
  normalizePropKey,
  findNotionProp,
  findNotionPropKey,
  extractNotionTitle,
  extractNotionNumber,
  extractNotionUrl,
  extractNotionFileUrl,
  extractNotionMultiSelect,
  extractNotionSelect,
  extractNotionRichText,
  extractNotionDate,
  extractNotionRating,
  extractNotionCompletionDate,
  extractNotionSummary,
} from "./notion-props.helper";

const GAME_DATE_ALIASES = [
  "Fecha de Culminación (primera campaña)",
  "Fecha de Culminación",
  "Fecha de Finalización",
  "Fecha de Término",
  "Fecha de Completado",
  "Completion Date",
  "Completed At",
  "Fecha Fin",
  "Culminado",
];

const MOVIE_DATE_ALIASES = [
  "Fecha de Visualización",
  "Fecha de Culminación",
  "Fecha de Finalización",
  "Watched Date",
  "Fecha",
  "Completion Date",
  "Fecha Fin",
  "Vista en",
];

const RATING_ALIASES = [
  "Calificación Personal",
  "Calificación",
  "Rating",
  "Puntuación",
  "Nota",
  "Score",
  "Estrellas",
];

const SUMMARY_ALIASES = [
  "Pensamiento Personal",
  "Pensamiento",
  "Opinión Personal",
  "Opinión",
  "Notas Personales",
  "Notas",
  "User Notes",
  "Personal Notes",
  "Mis Notas",
  "Mi Opinión",
  "Comentario Personal",
  "Review Personal",
  "Reseña Personal",
  "Reseña",
  "Personal Thoughts",
  "Personal Summary",
  "Crítica Personal",
];

export interface SyncStats {
  processed: number;
  updated: number;
  created: number;
  durationMs: number;
}

export interface GameSyncStats extends SyncStats {
  gamesProcessed: number;
  gamesUpdated: number;
  gamesCreated: number;
}

export interface MovieSyncStats extends SyncStats {
  moviesProcessed: number;
  moviesUpdated: number;
  moviesCreated: number;
}

export class NotionSyncService {
  private lastGameSyncWatermark: Date | null = null;
  private lastMovieSyncWatermark: Date | null = null;

  constructor(
    private client: INotionSyncClient = notionClient,
    private gameRepo: IGameRepository = gameRepository,
    private movieRepo: IMovieRepository = movieRepository,
    private gamesDbId: string = config.notionDatabaseIdGames,
    private moviesDbId: string = config.notionDatabaseIdMovies
  ) {}

  setLastGameSyncWatermark(date: Date | null): void {
    this.lastGameSyncWatermark = date;
  }

  getLastGameSyncWatermark(): Date | null {
    return this.lastGameSyncWatermark;
  }

  setLastMovieSyncWatermark(date: Date | null): void {
    this.lastMovieSyncWatermark = date;
  }

  getLastMovieSyncWatermark(): Date | null {
    return this.lastMovieSyncWatermark;
  }

  // Helper preservado para compatibilidad y tests unitarios
  private extractRating = extractNotionRating;


  /**
   * Sincronización inteligente delta de videojuegos desde Notion.
   * - Emplea marca de agua basada en `last_edited_time`.
   * - Cuenta con guard anti-loop para evitar re-escrituras locales idénticas.
   * - Respeta candados manuales de usuario (no revierte estado terminal 'Jugado').
   * - Gestiona tombstones (páginas archivadas).
   */
  async syncGames(forceFullSync: boolean = false): Promise<GameSyncStats> {
    const startTime = performance.now();
    let processed = 0;
    let updated = 0;
    let created = 0;

    if (!this.gamesDbId) {
      console.warn("[NotionSync] No games database ID configured (DB_ID_GAMES / NOTION_DB_GAMES). Skipping games sync.");
      return {
        processed: 0,
        updated: 0,
        created: 0,
        durationMs: 0,
        gamesProcessed: 0,
        gamesUpdated: 0,
        gamesCreated: 0,
      };
    }

    const watermark = forceFullSync ? null : this.lastGameSyncWatermark;
    const pages: NotionPageDelta[] = watermark
      ? await this.client.fetchModifiedPages(this.gamesDbId, watermark)
      : await this.client.fetchAllPages(this.gamesDbId);

    const now = new Date();

    for (const page of pages) {
      // Manejo de tombstones: páginas archivadas o borradas en Notion
      if (page.archived) {
        const existing = await this.gameRepo.findByNotionPageId(page.id);
        if (existing) {
          await this.gameRepo.delete(existing.id);
          updated++;
        }
        continue;
      }

      const props = page.properties;
      const title = extractNotionTitle(props);
      if (!title) continue;

      processed++;

      const clean = cleanGameTitle(title);
      const steamAppId = extractNotionNumber(props, ["Steam ID", "Steam ID ", "Steam App ID", "SteamId"]);
      const playtimeNotion = extractNotionNumber(props, ["Horas Jugadas", "Horas", "Playtime"]) ?? 0;
      const hltbMain = extractNotionNumber(props, ["HLTB Principal", "HLTB Main"]);
      const hltbCompletionist = extractNotionNumber(props, ["HLTB Completista", "HLTB 100%"]);
      const pageCoverUrl =
        (page.cover as any)?.external?.url || (page.cover as any)?.file?.url || null;
      const coverUrl =
        extractNotionFileUrl(props, ["Portada", "Cover", "Banner"]) || pageCoverUrl;
      const genres = extractNotionMultiSelect(props, ["Géneros", "Generos", "Genres"]);
      const link = extractNotionUrl(props, ["Link", "URL", "Wikipedia", "Wiki", "Enlace"]);
      const platform = extractNotionSelect(props, ["Plataforma", "Platform"], "PC");
      let status = extractNotionSelect(props, ["Estado", "Status"], "Por Jugar");
      const startDate = extractNotionDate(props, ["Fecha de Inicio", "Start Date"]);
      const completionDate = extractNotionCompletionDate(props, GAME_DATE_ALIASES);
      const rating = extractNotionRating(props, RATING_ALIASES);
      const summary = extractNotionSummary(props, SUMMARY_ALIASES);

      // Comprobar existencia previa por notionPageId o cleanTitle
      let existing = await this.gameRepo.findByNotionPageId(page.id);
      if (!existing && clean) {
        existing = await this.gameRepo.findByCleanTitle(clean);
      }

      if (existing) {
        // Anti-Loop Guard: Si el registro local ya se sincronizó después o al mismo tiempo que la edición de Notion
        const notionEditTime = new Date(page.lastEditedTime).getTime();
        const localSyncTime = existing.lastSyncAt ? existing.lastSyncAt.getTime() : 0;

        if (localSyncTime > 0 && notionEditTime <= localSyncTime) {
          continue;
        }

        // Respeto de Candados Manuales (Zero-Overwrite)
        if (existing.status === "Jugado" && status === "Por Jugar") {
          status = "Jugado";
        }
      }

      await this.gameRepo.upsert({
        notionPageId: page.id,
        title,
        cleanTitle: clean,
        steamAppId: steamAppId ?? existing?.steamAppId ?? undefined,
        playtimeForever: existing ? Math.max(existing.playtimeForever, playtimeNotion) : playtimeNotion,
        playtimeNotion,
        hltbMain: hltbMain ?? existing?.hltbMain ?? undefined,
        hltbCompletionist: hltbCompletionist ?? existing?.hltbCompletionist ?? undefined,
        coverUrl: coverUrl ?? existing?.coverUrl ?? undefined,
        genres: JSON.stringify(genres.length > 0 ? genres : (existing ? JSON.parse(existing.genres || "[]") : [])),
        notionGenres: JSON.stringify(genres.length > 0 ? genres : (existing ? JSON.parse((existing as any).notionGenres || "[]") : [])),
        link: link ?? existing?.link ?? undefined,
        platform,
        status,
        startDate: startDate ?? existing?.startDate ?? undefined,
        completedAt: completionDate ?? (existing as any)?.completedAt ?? existing?.completionDate ?? undefined,
        completionDate: completionDate ?? existing?.completionDate ?? (existing as any)?.completedAt ?? undefined,
        rating: rating ?? existing?.rating ?? undefined,
        userNotes: summary ?? (existing as any)?.userNotes ?? existing?.summary ?? undefined,
        personalSummary: summary ?? (existing as any)?.personalSummary ?? existing?.summary ?? undefined,
        summary: summary ?? existing?.summary ?? (existing as any)?.personalSummary ?? (existing as any)?.userNotes ?? undefined,
        lastSyncAt: now,
      });

      if (existing) updated++;
      else created++;
    }

    this.lastGameSyncWatermark = now;
    const durationMs = Math.round(performance.now() - startTime);

    if (updated > 0 || created > 0) {
      broadcastEvent("catalog_updated", { entity: "games", updated, created });
    }

    return {
      processed,
      updated,
      created,
      durationMs,
      gamesProcessed: processed,
      gamesUpdated: updated,
      gamesCreated: created,
    };
  }

  /**
   * Sincronización inteligente delta de películas desde Notion.
   */
  async syncMovies(forceFullSync: boolean = false): Promise<MovieSyncStats> {
    const startTime = performance.now();
    let processed = 0;
    let updated = 0;
    let created = 0;

    if (!this.moviesDbId) {
      console.warn("[NotionSync] No movies database ID configured (DB_ID_MOVIES / NOTION_DB_MOVIES). Skipping movies sync.");
      return {
        processed: 0,
        updated: 0,
        created: 0,
        durationMs: 0,
        moviesProcessed: 0,
        moviesUpdated: 0,
        moviesCreated: 0,
      };
    }

    const watermark = forceFullSync ? null : this.lastMovieSyncWatermark;
    const pages: NotionPageDelta[] = watermark
      ? await this.client.fetchModifiedPages(this.moviesDbId, watermark)
      : await this.client.fetchAllPages(this.moviesDbId);

    const now = new Date();

    for (const page of pages) {
      if (page.archived) {
        const existing = await this.movieRepo.findByNotionPageId(page.id);
        if (existing) {
          await this.movieRepo.delete(existing.id);
          updated++;
        }
        continue;
      }

      const props = page.properties;
      const rawTitle = extractNotionTitle(props);
      if (!rawTitle) continue;

      processed++;

      // Detección de año entre paréntesis en el título (ej: "Oppenheimer (2023)")
      let title = rawTitle;
      let detectedYear: number | null = null;
      const yearMatch = rawTitle.match(/(.+?)\s*\((\d{4})\)/);
      if (yearMatch && yearMatch[1] && yearMatch[2]) {
        title = yearMatch[1].trim();
        detectedYear = parseInt(yearMatch[2], 10);
      }

      const explicitYear = extractNotionNumber(props, ["Año", "Year"]);
      const year = explicitYear ?? detectedYear;
      const clean = cleanGameTitle(title);
      const pageCoverUrl =
        (page.cover as any)?.external?.url || (page.cover as any)?.file?.url || null;
      const posterUrl =
        extractNotionFileUrl(props, ["Portada", "Poster", "Cover"]) || pageCoverUrl;
      const overview = extractNotionRichText(props, ["Resumen", "Overview", "Sinopsis"]);
      const genres = extractNotionMultiSelect(props, ["Géneros", "Generos", "Genres"]);
      const wikiUrl = extractNotionUrl(props, ["Link", "Wikipedia", "URL"]);
      let status = extractNotionSelect(props, ["Estado", "Status"], "Por Ver");
      const completionDate =
        extractNotionDate(props, MOVIE_DATE_ALIASES, false) ||
        extractNotionCompletionDate(props, MOVIE_DATE_ALIASES);
      const rating = extractNotionRating(props, RATING_ALIASES);
      const summary = extractNotionSummary(props, SUMMARY_ALIASES);

      let existing = await this.movieRepo.findByNotionPageId(page.id);
      if (!existing && clean) {
        existing = await this.movieRepo.findByCleanTitle(clean);
      }

      if (existing) {
        const notionEditTime = new Date(page.lastEditedTime).getTime();
        const localSyncTime = existing.lastSyncAt ? existing.lastSyncAt.getTime() : 0;

        if (localSyncTime > 0 && notionEditTime <= localSyncTime) {
          continue;
        }

        // Respeto de Candados Manuales (Zero-Overwrite)
        if (existing.status === "Vista" && status === "Por Ver") {
          status = "Vista";
        }
      }

      await this.movieRepo.upsert({
        notionPageId: page.id,
        title,
        cleanTitle: clean,
        tmdbId: existing?.tmdbId,
        posterUrl: posterUrl ?? existing?.posterUrl ?? undefined,
        overview: overview ?? existing?.overview ?? undefined,
        genres: JSON.stringify(genres.length > 0 ? genres : (existing ? JSON.parse(existing.genres || "[]") : [])),
        wikiUrl: wikiUrl ?? existing?.wikiUrl ?? undefined,
        status,
        year: year ?? existing?.year ?? undefined,
        completionDate: completionDate ?? existing?.completionDate ?? undefined,
        rating: rating ?? existing?.rating ?? undefined,
        summary: summary ?? existing?.summary ?? undefined,
        lastSyncAt: now,
      });

      if (existing) updated++;
      else created++;
    }

    this.lastMovieSyncWatermark = now;
    const durationMs = Math.round(performance.now() - startTime);

    if (updated > 0 || created > 0) {
      broadcastEvent("catalog_updated", { entity: "movies", updated, created });
    }

    return {
      processed,
      updated,
      created,
      durationMs,
      moviesProcessed: processed,
      moviesUpdated: updated,
      moviesCreated: created,
    };
  }
}

export const notionSyncService = new NotionSyncService();
