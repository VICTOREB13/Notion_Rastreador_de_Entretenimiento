import type {
  ISteamClient,
  INotionSyncClient,
  IRawgClient,
  IHltbClient,
  IWikipediaClient,
  IGameRepository,
  NotionPageDelta,
  SteamOwnedGame,
} from "@repo/database";
import {
  gameRepository,
  cleanGameTitle,
  computeSimilarityRatio,
  formatLocalDate,
} from "@repo/database";
import { steamClient } from "../clients/steam.client";
import { notionClient } from "../clients/notion.client";
import { rawgClient } from "../clients/rawg.client";
import { hltbClient } from "../clients/hltb.client";
import { wikipediaClient } from "../clients/wikipedia.client";
import { broadcastEvent } from "../controllers/events.controller";
import { config } from "../config";
import { extractNotionTitle, extractNotionNumber } from "./notion-props.helper";
import {
  buildNotionUpdatePayload,
  buildNotionCreatePayload,
} from "./steam-notion-payload.helper";

export interface SteamSyncResult {
  scannedSteam: number;
  updatedNotion: number;
  createdNotion: number;
  skippedLowPlaytime: number;
  durationMs: number;
}

export class SteamToNotionSyncService {
  constructor(
    private steam: ISteamClient = steamClient,
    private notion: INotionSyncClient = notionClient,
    private rawg: IRawgClient = rawgClient,
    private hltb: IHltbClient = hltbClient,
    private wiki: IWikipediaClient = wikipediaClient,
    private gameRepo: IGameRepository = gameRepository,
    private steamUserId: string = config.steamUserId,
    private gamesDbId: string = config.notionDatabaseIdGames,
    private rateLimitDelayMs: number = 350
  ) {}

  private async sleep(): Promise<void> {
    if (this.rateLimitDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs));
    }
  }

  /**
   * Ejecuta la sincronización completa y determinista desde Steam hacia Notion (SSoT).
   * Respeta fielmente todas las validaciones de games.py:
   * - Filtro mínimo de 30 minutos (0.5h).
   * - Triple estrategia de matching (Steam ID, nombre limpio, fuzzy ratio >= 0.90).
   * - Preservación absoluta de cuota RAWG: NUNCA consulta si la página ya tiene portada y géneros.
   * - Preservación de estados: solo actualiza horas a menos que aplique la auto-culminación HLTB.
   * - Auto-culminación HLTB: horas >= HLTB Principal pasa a "Jugado" con fecha de culminación.
   * - Emisión reactiva de evento SSE catalog_updated.
   */
  async syncSteamToNotion(): Promise<SteamSyncResult> {
    const startMs = Date.now();
    let scannedSteam = 0;
    let updatedNotion = 0;
    let createdNotion = 0;
    let skippedLowPlaytime = 0;

    if (!this.gamesDbId) {
      console.warn("[SteamToNotionSync] No games database ID configured. Skipping.");
      return {
        scannedSteam: 0,
        updatedNotion: 0,
        createdNotion: 0,
        skippedLowPlaytime: 0,
        durationMs: Date.now() - startMs,
      };
    }

    // 1. Leer todas las páginas actuales de Notion
    const notionPages = await this.notion.fetchAllPages(this.gamesDbId);
    console.log(`[SteamToNotionSync] Leídas ${notionPages.length} páginas desde Notion`);

    // Índices auxiliares para búsqueda rápida en Notion
    const notionBySteamId = new Map<number, NotionPageDelta>();
    const notionByCleanTitle = new Map<string, NotionPageDelta>();
    const allNotionRecords: Array<{ cleanTitle: string; page: NotionPageDelta }> = [];

    for (const page of notionPages) {
      if (page.archived) continue;
      const props = page.properties as Record<string, any>;
      const title = extractNotionTitle(props);
      const steamId = extractNotionNumber(props, ["Steam ID", "SteamId", "AppId"]);

      if (steamId) {
        notionBySteamId.set(steamId, page);
      }
      if (title) {
        const clean = cleanGameTitle(title);
        notionByCleanTitle.set(clean, page);
        allNotionRecords.push({ cleanTitle: clean, page });
      }
    }

    // 2. Obtener catálogo combinado de Steam (propios + Family Sharing)
    let steamGames: SteamOwnedGame[] = [];
    if (this.steam.getCombinedGames) {
      steamGames = await this.steam.getCombinedGames(this.steamUserId);
    } else {
      steamGames = await this.steam.getOwnedGames(this.steamUserId);
    }

    scannedSteam = steamGames.length;
    console.log(`[SteamToNotionSync] Obtenidos ${steamGames.length} juegos desde Steam`);

    // 3. Procesar cada juego de Steam
    for (const g of steamGames) {
      const hours = g.playtimeMinutes / 60;

      // FILTRO ESTRICTO: Ignorar juegos con menos de 30 minutos (0.5 horas)
      if (hours < 0.5) {
        skippedLowPlaytime++;
        continue;
      }

      const steamCleanTitle = cleanGameTitle(g.name);

      // TRIPLE ESTRATEGIA DE MATCHING
      let matchedPage: NotionPageDelta | null = null;

      // Intento 1: Búsqueda exacta por Steam ID
      if (notionBySteamId.has(g.appId)) {
        matchedPage = notionBySteamId.get(g.appId)!;
      }
      // Intento 2: Búsqueda exacta por título normalizado/limpio
      else if (notionByCleanTitle.has(steamCleanTitle)) {
        matchedPage = notionByCleanTitle.get(steamCleanTitle)!;
      }
      // Intento 3: Búsqueda por similitud difusa (fuzzy ratio >= 0.90)
      else {
        let bestRatio = 0.9;
        for (const record of allNotionRecords) {
          const ratio = computeSimilarityRatio(steamCleanTitle, record.cleanTitle);
          if (ratio >= bestRatio) {
            bestRatio = ratio;
            matchedPage = record.page;
          }
        }
      }

      if (matchedPage) {
        // --- JUEGO YA EXISTE EN NOTION ---
        const updatePayload = await buildNotionUpdatePayload({
          matchedPage,
          game: g,
          hours,
          fetchHltb: (name) => this.hltb.searchDuration(name),
          fetchRawg: (name) => this.rawg.searchGame(name),
          fetchWikiUrl: (name) =>
            this.wiki.searchGameWikiUrl
              ? this.wiki.searchGameWikiUrl(name)
              : this.wiki.searchArticleUrl(name),
        });

        // Si nada cambió, NO enviar petición a Notion (cero tráfico inútil)
        if (updatePayload.needsUpdate) {
          if (this.notion.updatePage) {
            await this.notion.updatePage(matchedPage.id, {
              properties: updatePayload.payloadProps,
              cover: updatePayload.coverPayload,
              icon: updatePayload.iconPayload,
            });
          } else {
            await this.notion.updatePageProperties(matchedPage.id, updatePayload.payloadProps);
          }
          updatedNotion++;

          // Actualizar SQLite cache de forma idempotente
          const resolvedTitle = extractNotionTitle(matchedPage.properties as Record<string, any>) || g.name;
          await this.gameRepo.upsert({
            notionPageId: matchedPage.id,
            title: resolvedTitle,
            cleanTitle: cleanGameTitle(resolvedTitle),
            steamAppId: g.appId,
            playtimeForever: updatePayload.roundedNewHours,
            playtimeNotion: updatePayload.roundedNewHours,
            hltbMain: updatePayload.hltbPrincipal,
            status: updatePayload.payloadProps["Estado"]?.status?.name || updatePayload.estadoActual || "Por Jugar",
            platform: "PC",
          });

          await this.sleep();
        }
      } else {
        // --- JUEGO NUEVO: CREAR EN NOTION ---
        const rawgData = await this.rawg.searchGame(g.name);
        const hltbEst = await this.hltb.searchDuration(g.name);
        const wikiUrl = this.wiki.searchGameWikiUrl
          ? await this.wiki.searchGameWikiUrl(g.name)
          : await this.wiki.searchArticleUrl(g.name);

        const createPayload = buildNotionCreatePayload({
          game: g,
          hours,
          rawgData,
          hltbEst,
          wikiUrl,
        });

        const newPageId = await this.notion.createPage(
          this.gamesDbId,
          createPayload.newProps,
          createPayload.newCover,
          createPayload.newIcon
        );
        createdNotion++;

        // Registrar en SQLite cache
        await this.gameRepo.upsert({
          notionPageId: newPageId,
          title: g.name,
          cleanTitle: steamCleanTitle,
          steamAppId: g.appId,
          playtimeForever: createPayload.roundedHours,
          playtimeNotion: createPayload.roundedHours,
          hltbMain: hltbEst.mainHours,
          hltbCompletionist: hltbEst.completionistHours,
          coverUrl: rawgData?.backgroundImage || null,
          genres: JSON.stringify(rawgData?.genres || []),
          link: wikiUrl,
          platform: "PC",
          status: createPayload.initialStatus,
          startDate: hours > 0 ? formatLocalDate() : null,
        });

        // Registrar en índices en memoria para subsiguientes coincidencias
        const mockNewPage: NotionPageDelta = {
          id: newPageId,
          lastEditedTime: new Date().toISOString(),
          properties: createPayload.newProps,
          cover: createPayload.newCover,
        };
        notionBySteamId.set(g.appId, mockNewPage);
        notionByCleanTitle.set(steamCleanTitle, mockNewPage);
        allNotionRecords.push({ cleanTitle: steamCleanTitle, page: mockNewPage });

        await this.sleep();
      }
    }

    const durationMs = Date.now() - startMs;
    console.log(
      `[SteamToNotionSync] Sincronización completada en ${durationMs}ms: ${updatedNotion} actualizados, ${createdNotion} creados, ${skippedLowPlaytime} omitidos (<0.5h).`
    );

    // 4. Notificar a clientes web vía Server-Sent Events si hubo cambios o sync
    broadcastEvent("catalog_updated", {
      type: "games",
      updated: updatedNotion,
      created: createdNotion,
      timestamp: new Date().toISOString(),
    });

    return {
      scannedSteam,
      updatedNotion,
      createdNotion,
      skippedLowPlaytime,
      durationMs,
    };
  }
}

export const steamToNotionSyncService = new SteamToNotionSyncService();
