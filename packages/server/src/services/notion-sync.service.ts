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

  private normalizePropKey(str: string): string {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  private findProp(props: Record<string, any>, aliases: string[]): any {
    for (const alias of aliases) {
      if (alias in props) return props[alias];
    }
    const lowerMap: Record<string, string> = {};
    const normMap: Record<string, string> = {};
    for (const key of Object.keys(props)) {
      lowerMap[key.toLowerCase()] = key;
      normMap[this.normalizePropKey(key)] = key;
    }
    for (const alias of aliases) {
      const lower = alias.toLowerCase();
      if (lower in lowerMap) return props[lowerMap[lower]];
    }
    for (const alias of aliases) {
      const norm = this.normalizePropKey(alias);
      if (norm in normMap) return props[normMap[norm]];
    }
    return undefined;
  }

  private findPropKey(props: Record<string, any>, aliases: string[]): string | null {
    for (const alias of aliases) {
      if (alias in props) return alias;
    }
    const lowerMap: Record<string, string> = {};
    const normMap: Record<string, string> = {};
    for (const key of Object.keys(props)) {
      lowerMap[key.toLowerCase()] = key;
      normMap[this.normalizePropKey(key)] = key;
    }
    for (const alias of aliases) {
      const lower = alias.toLowerCase();
      if (lower in lowerMap) return lowerMap[lower];
    }
    for (const alias of aliases) {
      const norm = this.normalizePropKey(alias);
      if (norm in normMap) return normMap[norm];
    }
    return null;
  }

  private extractTitle(props: Record<string, any>): string {
    const prop = this.findProp(props, [
      "Título",
      "Titulo",
      "Title",
      "Name",
      "Nombre",
      "Película",
      "Pelicula",
      "Juego",
      "Videojuego",
    ]);
    if (prop?.title && Array.isArray(prop.title) && prop.title.length > 0) {
      return prop.title
        .map((t: any) => t?.plain_text || t?.text?.content || "")
        .join("")
        .trim();
    }
    // Fallback dinámico: encontrar cualquier propiedad que sea de tipo 'title' en Notion
    for (const key of Object.keys(props)) {
      const p = props[key];
      if (p?.type === "title" || (Array.isArray(p?.title) && p.title.length > 0)) {
        return (p.title || [])
          .map((t: any) => t?.plain_text || t?.text?.content || "")
          .join("")
          .trim();
      }
    }
    return "";
  }

  private extractNumber(props: Record<string, any>, aliases: string[]): number | null {
    const prop = this.findProp(props, aliases);
    if (typeof prop?.number === "number") {
      return prop.number;
    }
    if (prop?.formula?.type === "number" && typeof prop.formula.number === "number") {
      return prop.formula.number;
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
      return prop.rich_text.map((t: any) => t.plain_text || t.text?.content || "").join("").trim() || null;
    }
    if (prop?.formula?.type === "string" && typeof prop.formula.string === "string") {
      return prop.formula.string.trim() || null;
    }
    return null;
  }

  private extractDate(props: Record<string, any>, aliases: string[], preferEnd: boolean = false): string | null {
    const prop = this.findProp(props, aliases);
    if (!prop) return null;

    if (preferEnd && prop?.date?.end) {
      return prop.date.end;
    }
    if (prop?.date?.start) {
      return prop.date.start;
    }
    if (prop?.date?.end) {
      return prop.date.end;
    }
    if (prop?.formula?.type === "date" && prop?.formula?.date) {
      if (preferEnd && prop.formula.date.end) return prop.formula.date.end;
      return prop.formula.date.start || prop.formula.date.end || null;
    }
    if (prop?.rollup?.type === "date" && prop?.rollup?.date) {
      if (preferEnd && prop.rollup.date.end) return prop.rollup.date.end;
      return prop.rollup.date.start || prop.rollup.date.end || null;
    }
    if (prop?.formula?.type === "string" && typeof prop.formula.string === "string") {
      return prop.formula.string.trim() || null;
    }
    return null;
  }

  private extractRating(props: Record<string, any>, aliases: string[]): number | null {
    const prop = this.findProp(props, aliases);
    if (!prop) return null;

    let num: number | null = null;
    if (typeof prop?.number === "number") {
      num = prop.number;
    } else if (prop?.formula?.type === "number" && typeof prop.formula.number === "number") {
      num = prop.formula.number;
    } else if (prop?.rollup?.type === "number" && typeof prop.rollup.number === "number") {
      num = prop.rollup.number;
    } else if (prop?.rollup?.type === "array" && Array.isArray(prop.rollup.array) && prop.rollup.array.length > 0) {
      const first = prop.rollup.array[0];
      if (typeof first?.number === "number") num = first.number;
    }

    if (num !== null && !isNaN(num)) {
      if (num <= 0) return null;
      if (num > 5 && num <= 10) return Math.round((num / 2) * 10) / 10;
      if (num > 10 && num <= 100) return Math.round((num / 20) * 10) / 10;
      if (num > 100) return null;
      return Math.min(5, Math.max(0.5, Math.round(num * 10) / 10));
    }

    let textVal = "";
    if (prop?.select?.name) {
      textVal = prop.select.name;
    } else if (prop?.status?.name) {
      textVal = prop.status.name;
    } else if (prop?.multi_select && Array.isArray(prop.multi_select) && prop.multi_select.length > 0) {
      textVal = prop.multi_select.map((m: any) => m.name).join(" ");
    } else if (prop?.formula?.type === "string" && typeof prop.formula.string === "string") {
      textVal = prop.formula.string;
    } else if (prop?.rich_text && Array.isArray(prop.rich_text) && prop.rich_text.length > 0) {
      textVal = prop.rich_text.map((t: any) => t.plain_text || t.text?.content || "").join("").trim();
    } else if (prop?.rollup?.type === "array" && Array.isArray(prop.rollup.array) && prop.rollup.array.length > 0) {
      const first = prop.rollup.array[0];
      if (first?.select?.name) textVal = first.select.name;
      else if (first?.rich_text) textVal = first.rich_text.map((t: any) => t.plain_text || "").join("").trim();
    }

    textVal = textVal.trim();
    if (!textVal) return null;

    // Conteo o descarte de casos explícitos "sin calificar" o 0
    const lower = textVal.toLowerCase();
    if (
      lower === "0" ||
      lower === "0/5" ||
      lower === "0/10" ||
      lower === "0.0" ||
      lower === "sin calificar" ||
      lower === "unrated" ||
      lower === "none" ||
      lower === "n/a" ||
      lower === "-" ||
      lower === "--" ||
      lower === "☆☆☆☆☆"
    ) {
      return null;
    }

    // 1. Formato fraccionario (ej: "5/5", "4.5/5", "8/10", "9/10", "4.5 de 5", "9 de 10", "4.5 / 5 ⭐")
    const fracMatch = textVal.match(/(\d+(?:[\.,]\d+)?)\s*(?:\/|de|sobre)\s*(\d+(?:[\.,]\d+)?)/i);
    if (fracMatch) {
      const val = parseFloat(fracMatch[1].replace(",", "."));
      const max = parseFloat(fracMatch[2].replace(",", "."));
      if (val <= 0 || isNaN(val) || isNaN(max) || max <= 0) return null;
      if (max === 5) return Math.min(5, Math.max(0.5, Math.round(val * 10) / 10));
      if (max === 10) return Math.min(5, Math.max(0.5, Math.round((val / 2) * 10) / 10));
      if (max === 100) return Math.min(5, Math.max(0.5, Math.round((val / 20) * 10) / 10));
      return Math.min(5, Math.max(0.5, Math.round((val / max) * 5 * 10) / 10));
    }

    // 2. Número con estrella o texto de estrellas (ej: "4.5 ⭐", "5 ⭐", "4.5 estrellas", "5 stars", "⭐ 4.5", "5 ⭐ - Masterpiece")
    const numStarMatch =
      textVal.match(/(?:[⭐★🌟]\s*)?(\d+(?:[\.,]\d+)?)\s*(?:[⭐★🌟]|estrellas?|stars?)/i) ||
      textVal.match(/(?:estrellas?|stars?)\s*(\d+(?:[\.,]\d+)?)/i);
    if (numStarMatch) {
      const parsedVal = parseFloat(numStarMatch[1].replace(",", "."));
      if (parsedVal <= 0 || isNaN(parsedVal)) return null;
      if (parsedVal > 5 && parsedVal <= 10) return Math.round((parsedVal / 2) * 10) / 10;
      if (parsedVal > 10 && parsedVal <= 100) return Math.round((parsedVal / 20) * 10) / 10;
      if (parsedVal <= 5) return Math.min(5, Math.max(0.5, Math.round(parsedVal * 10) / 10));
    }

    // 3. Conteo de estrellas visuales exclusivamente o con medio símbolo (ej: "⭐⭐⭐⭐⭐", "⭐⭐⭐⭐½", "★★★★☆", "★★★½")
    const stars = textVal.match(/[⭐★🌟]/g);
    if (stars && stars.length > 0) {
      const hasHalf = textVal.includes("½") || textVal.toLowerCase().includes(".5");
      const computed = stars.length + (hasHalf ? 0.5 : 0);
      return Math.min(5, Math.max(0.5, Math.round(computed * 10) / 10));
    }

    // 4. Formato de select con etiqueta al inicio (ej: "5 - Obra Maestra", "4 - Muy Bueno", "4.5: Excelente")
    const leadingNumMatch = textVal.match(/^(\d+(?:[\.,]\d+)?)\s*(?:[-–—:]|\s)\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]/);
    if (leadingNumMatch) {
      const parsed = parseFloat(leadingNumMatch[1].replace(",", "."));
      if (parsed <= 0 || isNaN(parsed)) return null;
      if (parsed > 5 && parsed <= 10) return Math.round((parsed / 2) * 10) / 10;
      if (parsed > 10 && parsed <= 100) return Math.round((parsed / 20) * 10) / 10;
      if (parsed <= 5) return Math.min(5, Math.max(0.5, Math.round(parsed * 10) / 10));
    }

    // 5. Número directo en texto (ej: "5", "4.5", "4,5", "8", "10")
    const parsed = parseFloat(textVal.replace(",", "."));
    if (!isNaN(parsed)) {
      if (parsed <= 0) return null;
      if (parsed > 5 && parsed <= 10) return Math.round((parsed / 2) * 10) / 10;
      if (parsed > 10 && parsed <= 100) return Math.round((parsed / 20) * 10) / 10;
      if (parsed <= 5) return Math.min(5, Math.max(0.5, Math.round(parsed * 10) / 10));
    }

    return null;
  }

  private extractCompletionDate(props: Record<string, any>, aliases: string[]): string | null {
    const dateVal = this.extractDate(props, aliases, true);
    if (dateVal) return dateVal;

    const prop = this.findProp(props, aliases);
    if (!prop) return null;

    if (prop?.date?.end) {
      return prop.date.end;
    }
    if (prop?.date?.start) {
      return prop.date.start;
    }
    if (prop?.formula?.date?.end) {
      return prop.formula.date.end;
    }
    if (prop?.formula?.date?.start) {
      return prop.formula.date.start;
    }
    if (prop?.rollup?.date?.end) {
      return prop.rollup.date.end;
    }
    if (prop?.rollup?.date?.start) {
      return prop.rollup.date.start;
    }
    if (prop?.rollup?.type === "array" && Array.isArray(prop.rollup.array) && prop.rollup.array.length > 0) {
      const first = prop.rollup.array[0];
      if (first?.date?.end || first?.date?.start) return first.date.end || first.date.start;
      if (first?.select?.name) return first.select.name.trim();
      if (first?.rich_text) return first.rich_text.map((t: any) => t.plain_text || "").join("").trim() || null;
    }
    if (prop?.formula?.type === "string" && typeof prop.formula.string === "string" && prop.formula.string.trim()) {
      return prop.formula.string.trim();
    }
    if (prop?.select?.name && prop.select.name.trim()) {
      return prop.select.name.trim();
    }
    if (prop?.status?.name && prop.status.name.trim()) {
      return prop.status.name.trim();
    }

    const textVal = this.extractRichText(props, aliases);
    if (textVal) return textVal;

    return null;
  }

  private extractSummary(props: Record<string, any>, aliases: string[]): string | null {
    // Buscar la primera propiedad de texto personal, excluyendo sinopsis externa
    for (const alias of aliases) {
      const propKey = this.findPropKey(props, [alias]);
      if (propKey) {
        const lowerKey = propKey.toLowerCase();
        // Guard estricto: no confundir con sinopsis externa
        if (
          lowerKey.includes("sinopsis") ||
          lowerKey.includes("overview") ||
          lowerKey.includes("plot") ||
          lowerKey.includes("descripcion") ||
          lowerKey.includes("descripción")
        ) {
          continue;
        }
        const val = this.extractRichText(props, [propKey]);
        if (val) return val;
      }
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
      const completionDate = this.extractCompletionDate(props, [
        "Fecha de Culminación",
        "Fecha de Finalización",
        "Completion Date",
        "Fecha Fin",
        "Vista en",
      ]);
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
