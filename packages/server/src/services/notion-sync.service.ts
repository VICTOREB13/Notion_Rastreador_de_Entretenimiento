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

  // --- Delegación al motor unificado SSoT de Notion (notion-props.helper) ---
  private normalizePropKey = normalizePropKey;
  private findProp = findNotionProp;
  private findPropKey = findNotionPropKey;
  private extractTitle = extractNotionTitle;
  private extractNumber = extractNotionNumber;
  private extractUrl = extractNotionUrl;
  private extractFileUrl = extractNotionFileUrl;
  private extractMultiSelect = extractNotionMultiSelect;
  private extractSelect = extractNotionSelect;
  private extractRichText = extractNotionRichText;
  private extractDate = extractNotionDate;
  private extractRating = extractNotionRating;
  private extractCompletionDate = extractNotionCompletionDate;
  private extractSummary = extractNotionSummary;

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
      const title = this.extractTitle(props);
      if (!title) continue;

      processed++;

      const clean = cleanGameTitle(title);
      const steamAppId = this.extractNumber(props, ["Steam ID", "Steam ID ", "Steam App ID", "SteamId"]);
      const playtimeNotion = this.extractNumber(props, ["Horas Jugadas", "Horas", "Playtime"]) ?? 0;
      const hltbMain = this.extractNumber(props, ["HLTB Principal", "HLTB Main"]);
      const hltbCompletionist = this.extractNumber(props, ["HLTB Completista", "HLTB 100%"]);
      const pageCoverUrl =
        (page.cover as any)?.external?.url || (page.cover as any)?.file?.url || null;
      const coverUrl =
        this.extractFileUrl(props, ["Portada", "Cover", "Banner"]) || pageCoverUrl;
      const genres = this.extractMultiSelect(props, ["Géneros", "Generos", "Genres"]);
      const link = this.extractUrl(props, ["Link", "URL", "Wikipedia", "Wiki", "Enlace"]);
      const platform = this.extractSelect(props, ["Plataforma", "Platform"], "PC");
      let status = this.extractSelect(props, ["Estado", "Status"], "Por Jugar");
      const startDate = this.extractDate(props, ["Fecha de Inicio", "Start Date"]);
      const completionDate = this.extractCompletionDate(props, [
        "Fecha de Culminación (primera campaña)",
        "Fecha de Culminación",
        "Fecha de Culminacion",
        "Fecha Culminación",
        "Fecha Culminacion",
        "Fecha de Finalización",
        "Fecha de Finalizacion",
        "Fecha Finalización",
        "Fecha Finalizacion",
        "Fecha de Término",
        "Fecha de Termino",
        "Fecha Término",
        "Fecha Termino",
        "Fecha de Completado",
        "Fecha Completado",
        "Fecha Completada",
        "Fecha Terminado",
        "Completion Date",
        "Completed Date",
        "Finished Date",
        "Date Completed",
        "Completed At",
        "Finished At",
        "Fecha Fin",
        "Fecha de Fin",
        "Fecha Final",
        "Culminado",
        "Finalizado",
        "Terminado",
        "Completed",
      ]);
      const rating = this.extractRating(props, [
        "Calificación Personal",
        "Calificacion Personal",
        "Calificación",
        "Calificacion",
        "Rating",
        "Puntuación",
        "Puntuacion",
        "Nota",
        "Score",
        "Estrellas",
        "Stars",
      ]);
      const summary = this.extractSummary(props, [
        "Pensamiento Personal",
        "Pensamientos Personales",
        "Pensamiento",
        "Pensamientos",
        "Opinión Personal",
        "Opinión",
        "Opinion Personal",
        "Opinion",
        "Opiniones",
        "Notas Personales",
        "Notas",
        "User Notes",
        "Personal Notes",
        "Mis Notas",
        "Mi Opinión",
        "Mi Opinion",
        "Comentario Personal",
        "Comentarios Personales",
        "Comentario",
        "Comentarios",
        "Review Personal",
        "Personal Review",
        "Review",
        "Reviews",
        "Reseña Personal",
        "Reseña",
        "Resena Personal",
        "Resena",
        "Reseñas",
        "Personal Thoughts",
        "Thoughts",
        "Notes",
        "Personal Summary",
        "Resumen Personal",
        "Resumen",
        "Crítica Personal",
        "Critica Personal",
        "Crítica",
        "Critica",
      ]);

      // Comprobar existencia previa por notionPageId o cleanTitle
      let existing = await this.gameRepo.findByNotionPageId(page.id);
      if (!existing && clean) {
        existing = await this.gameRepo.findByCleanTitle(clean);
      }

      if (existing) {
        // Anti-Loop Guard: Si el registro local ya se sincronizó después o al mismo tiempo que la edición de Notion
        const notionEditTime = new Date(page.lastEditedTime).getTime();
        const localSyncTime = existing.lastSyncAt ? existing.lastSyncAt.getTime() : 0;

        // Si la página de Notion no es más reciente que nuestra última sincronización, omitir
        if (localSyncTime > 0 && notionEditTime <= localSyncTime) {
          continue;
        }

        // Respeto de Candados Manuales (Zero-Overwrite)
        // Si localmente está en estado terminal "Jugado", no permitir que Notion lo regrese a "Por Jugar"
        if (existing.status === "Jugado" && status === "Por Jugar") {
          status = "Jugado";
        }

        await this.gameRepo.upsert({
          notionPageId: page.id,
          title,
          cleanTitle: clean,
          steamAppId: steamAppId ?? existing.steamAppId,
          playtimeForever: Math.max(existing.playtimeForever, playtimeNotion),
          playtimeNotion,
          hltbMain: hltbMain ?? existing.hltbMain,
          hltbCompletionist: hltbCompletionist ?? existing.hltbCompletionist,
          coverUrl: coverUrl ?? existing.coverUrl,
          genres: JSON.stringify(genres.length > 0 ? genres : JSON.parse(existing.genres || "[]")),
          notionGenres: JSON.stringify(genres.length > 0 ? genres : JSON.parse((existing as any).notionGenres || "[]")),
          link: link ?? existing.link,
          platform,
          status,
          startDate: startDate ?? existing.startDate,
          completedAt: completionDate ?? (existing as any).completedAt ?? existing.completionDate,
          completionDate: completionDate ?? existing.completionDate ?? (existing as any).completedAt,
          rating: rating ?? existing.rating,
          userNotes: summary ?? (existing as any).userNotes ?? existing.summary,
          personalSummary: summary ?? (existing as any).personalSummary ?? existing.summary,
          summary: summary ?? existing.summary ?? (existing as any).personalSummary,
          lastSyncAt: now,
        });
        updated++;
      } else {
        await this.gameRepo.upsert({
          notionPageId: page.id,
          title,
          cleanTitle: clean,
          steamAppId: steamAppId ?? undefined,
          playtimeForever: playtimeNotion,
          playtimeNotion,
          hltbMain: hltbMain ?? undefined,
          hltbCompletionist: hltbCompletionist ?? undefined,
          coverUrl: coverUrl ?? undefined,
          genres: JSON.stringify(genres),
          notionGenres: JSON.stringify(genres),
          link: link ?? undefined,
          platform,
          status,
          startDate: startDate ?? undefined,
          completedAt: completionDate ?? undefined,
          completionDate: completionDate ?? undefined,
          rating: rating ?? undefined,
          userNotes: summary ?? undefined,
          personalSummary: summary ?? undefined,
          summary: summary ?? undefined,
          lastSyncAt: now,
        });
        created++;
      }
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
      const rawTitle = this.extractTitle(props);
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

      const explicitYear = this.extractNumber(props, ["Año", "Year"]);
      const year = explicitYear ?? detectedYear;
      const clean = cleanGameTitle(title);
      const pageCoverUrl =
        (page.cover as any)?.external?.url || (page.cover as any)?.file?.url || null;
      const posterUrl =
        this.extractFileUrl(props, ["Portada", "Poster", "Cover"]) || pageCoverUrl;
      const overview = this.extractRichText(props, ["Resumen", "Overview", "Sinopsis"]);
      const genres = this.extractMultiSelect(props, ["Géneros", "Generos", "Genres"]);
      const wikiUrl = this.extractUrl(props, ["Link", "Wikipedia", "URL"]);
      let status = this.extractSelect(props, ["Estado", "Status"], "Por Ver");
      const movieDateAliases = [
        "Fecha de Visualización",
        "Fecha de Visualizacion",
        "Fecha de Culminación",
        "Fecha de Culminacion",
        "Fecha de Finalización",
        "Fecha de Finalizacion",
        "Watched Date",
        "Fecha",
        "Fecha Visualización",
        "Fecha Visualizacion",
        "Completion Date",
        "Fecha Fin",
        "Vista en",
      ];
      const completionDate =
        this.extractDate(props, movieDateAliases, false) ||
        this.extractCompletionDate(props, movieDateAliases);
      const rating = this.extractRating(props, [
        "Calificación",
        "Calificacion",
        "Rating",
        "Puntuación",
        "Nota",
        "Score",
      ]);
      const summary = this.extractSummary(props, [
        "Pensamiento Personal",
        "Pensamientos Personales",
        "Pensamiento",
        "Pensamientos",
        "Opinión Personal",
        "Opinión",
        "Opinion Personal",
        "Opinion",
        "Opiniones",
        "Notas Personales",
        "Notas",
        "User Notes",
        "Personal Notes",
        "Mis Notas",
        "Mi Opinión",
        "Mi Opinion",
        "Comentario Personal",
        "Comentarios Personales",
        "Comentario",
        "Comentarios",
        "Review Personal",
        "Personal Review",
        "Review",
        "Reviews",
        "Reseña Personal",
        "Reseña",
        "Resena Personal",
        "Resena",
        "Personal Thoughts",
        "Thoughts",
        "Notes",
        "Personal Summary",
        "Resumen Personal",
        "Crítica Personal",
        "Critica Personal",
        "Crítica",
        "Critica",
      ]);

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

        await this.movieRepo.upsert({
          notionPageId: page.id,
          title,
          cleanTitle: clean,
          tmdbId: existing.tmdbId,
          posterUrl: posterUrl ?? existing.posterUrl,
          overview: overview ?? existing.overview,
          genres: JSON.stringify(genres.length > 0 ? genres : JSON.parse(existing.genres || "[]")),
          wikiUrl: wikiUrl ?? existing.wikiUrl,
          status,
          year: year ?? existing.year,
          completionDate: completionDate ?? existing.completionDate,
          rating: rating ?? existing.rating,
          summary: summary ?? existing.summary,
          lastSyncAt: now,
        });
        updated++;
      } else {
        await this.movieRepo.upsert({
          notionPageId: page.id,
          title,
          cleanTitle: clean,
          posterUrl: posterUrl ?? undefined,
          overview: overview ?? undefined,
          genres: JSON.stringify(genres),
          wikiUrl: wikiUrl ?? undefined,
          status,
          year: year ?? undefined,
          completionDate: completionDate ?? undefined,
          rating: rating ?? undefined,
          summary: summary ?? undefined,
          lastSyncAt: now,
        });
        created++;
      }
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
