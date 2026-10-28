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

  // --- Helpers para extracción segura de propiedades Notion ---

  private findProp(props: Record<string, any>, aliases: string[]): any {
    for (const alias of aliases) {
      if (alias in props) return props[alias];
    }
    const lowerMap: Record<string, string> = {};
    for (const key of Object.keys(props)) {
      lowerMap[key.toLowerCase()] = key;
    }
    for (const alias of aliases) {
      const lower = alias.toLowerCase();
      if (lower in lowerMap) return props[lowerMap[lower]];
    }
    return undefined;
  }

  private extractTitle(props: Record<string, any>): string {
    const prop = this.findProp(props, ["Título", "Titulo", "Title", "Name", "Nombre", "Película", "Pelicula"]);
    if (prop?.title && Array.isArray(prop.title) && prop.title.length > 0) {
      return prop.title[0]?.text?.content?.trim() || "";
    }
    return "";
  }

  private extractNumber(props: Record<string, any>, aliases: string[]): number | null {
    const prop = this.findProp(props, aliases);
    if (typeof prop?.number === "number") {
      return prop.number;
    }
    return null;
  }

  private extractUrl(props: Record<string, any>, aliases: string[]): string | null {
    const prop = this.findProp(props, aliases);
    if (prop?.url && typeof prop.url === "string") {
      return prop.url;
    }
    return null;
  }

  private extractFileUrl(props: Record<string, any>, aliases: string[]): string | null {
    const prop = this.findProp(props, aliases);
    if (prop?.files && Array.isArray(prop.files) && prop.files.length > 0) {
      const fileObj = prop.files[0];
      return fileObj.file?.url || fileObj.external?.url || null;
    }
    return null;
  }

  private extractMultiSelect(props: Record<string, any>, aliases: string[]): string[] {
    const prop = this.findProp(props, aliases);
    if (prop?.multi_select && Array.isArray(prop.multi_select)) {
      return prop.multi_select.map((item: any) => item.name).filter(Boolean);
    }
    if (prop?.select?.name) {
      return [prop.select.name];
    }
    return [];
  }

  private extractSelect(props: Record<string, any>, aliases: string[], fallback: string): string {
    const prop = this.findProp(props, aliases);
    if (prop?.status?.name) {
      return prop.status.name;
    }
    if (prop?.select?.name) {
      return prop.select.name;
    }
    return fallback;
  }

  private extractRichText(props: Record<string, any>, aliases: string[]): string | null {
    const prop = this.findProp(props, aliases);
    if (prop?.rich_text && Array.isArray(prop.rich_text) && prop.rich_text.length > 0) {
      return prop.rich_text.map((t: any) => t.text?.content || "").join("").trim() || null;
    }
    return null;
  }

  private extractDate(props: Record<string, any>, aliases: string[]): string | null {
    const prop = this.findProp(props, aliases);
    if (prop?.date?.start) {
      return prop.date.start;
    }
    return null;
  }

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
      const coverUrl = this.extractFileUrl(props, ["Portada", "Cover", "Banner"]);
      const genres = this.extractMultiSelect(props, ["Géneros", "Generos", "Genres"]);
      const link = this.extractUrl(props, ["Link", "URL", "Enlace"]);
      const platform = this.extractSelect(props, ["Plataforma", "Platform"], "PC");
      let status = this.extractSelect(props, ["Estado", "Status"], "Por Jugar");
      const startDate = this.extractDate(props, ["Fecha de Inicio", "Start Date"]);

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
          link: link ?? existing.link,
          platform,
          status,
          startDate: startDate ?? existing.startDate,
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
          link: link ?? undefined,
          platform,
          status,
          startDate: startDate ?? undefined,
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
      const posterUrl = this.extractFileUrl(props, ["Portada", "Poster", "Cover"]);
      const overview = this.extractRichText(props, ["Resumen", "Overview", "Sinopsis"]);
      const genres = this.extractMultiSelect(props, ["Géneros", "Generos", "Genres"]);
      const wikiUrl = this.extractUrl(props, ["Link", "Wikipedia", "URL"]);
      let status = this.extractSelect(props, ["Estado", "Status"], "Por Ver");

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
